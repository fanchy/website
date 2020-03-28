---
layout: post
title:  进程上下文切换 – 残酷的性能杀手
categories: tech
tagline: 进程上下文切换 – 残酷的性能杀手
tags:
    - linux
    - 性能分析
    - 进程上下文切换
excerpt: >
    对于服务器的优化，很多人都有自己的经验和见解，但就我观察，有两点常常会被人忽视 – 上下文切换 和 Cache Line同步 问题，人们往往都会习惯性地把视线集中在尽力减少内存拷贝，减少IO次数这样的问题上，不可否认它们一样重要，但一个高性能服务器需要更细致地去考察这些问题，这个问题我将分成两篇文章来写：
---

进程上下文切换 – 残酷的性能杀手（上）(转载cppthinker.com)
对于服务器的优化，很多人都有自己的经验和见解，但就我观察，有两点常常会被人忽视 – 上下文切换 和 Cache Line同步 问题，人们往往都会习惯性地把视线集中在尽力减少内存拷贝，减少IO次数这样的问题上，不可否认它们一样重要，但一个高性能服务器需要更细致地去考察这些问题，这个问题我将分成两篇文章来写：

*  从一些我们常用的用户空间函数，到linux内核代码的跟踪，来看一个上下文切换是如何产生的
*  从实际数据来看它对我们程序的影响

另外，关于Cache Line 的测试大家可移步 http://www.cppthinker.com/cpp/9/cpu_cache/


## Context Switch简介 -

上下文切换（以下简称CS）的定义，http://www.linfo.org/context_switch.html 此文中已做了详细的说明，这里我又偷懒不详细解释了：）  只提炼以下几个关键要点：

*  context（这里我觉得叫process context更合适）是指CPU寄存器和程序计数器在任何时间点的内容
*  CS可以描述为kernel执行下面的操作
    *  挂起一个进程，并储存该进程当时在内存中所反映出的状态
    *  从内存中恢复下一个要执行的进程，恢复该进程原来的状态到寄存器，返回到其上次暂停的执行代码然后继续执行
*  CS只能发生在内核态(kernel mode)
*  system call会陷入内核态，是user mode => kernel mode的过程，我们称之为mode switch，但不表明会发生CS（其实mode switch同样也会做很多和CS一样的流程，例如通过寄存器传递user mode 和 kernel mode之间的一些参数）
*  一个硬件中断的产生，也可能导致kernel收到signal后进行CS

#### 什么样的操作可能会引起CS -

首先我们一定是希望减少CS，那什么样的操作会发生CS呢？也许看了上面的介绍你还云里雾里？

首先，linux中一个进程的时间片到期，或是有更高优先级的进程抢占时，是会发生CS的，但这些都是我们应用开发者不可控的。那么我们不妨更多地从应用开发者（user space）的角度来看这个问题，我们的进程可以主动地向内核申请进行CS，而用户空间通常有两种手段能达到这一“目的”：

*  休眠当前进程/线程
*  唤醒其他进程/线程

pthread库中的pthread_cond_wait 和 pthread_cond_signal就是很好的例子（虽然是针对线程，但linux内核并不区分进程和线程，线程只是共享了address space和其他资源罢了），pthread_cond_wait负责将当前线程挂起并进入休眠，直到条件成立的那一刻，而pthread_cond_signal则是唤醒守候条件的线程。我们直接来看它们的代码吧

pthread_cond_wait.c

```cpp
int
__pthread_cond_wait (cond, mutex)
     pthread_cond_t *cond;
     pthread_mutex_t *mutex;
{
  struct _pthread_cleanup_buffer buffer;
  struct _condvar_cleanup_buffer cbuffer;
  int err;
  int pshared = (cond->__data.__mutex == (void *) ~0l)
        ? LLL_SHARED : LLL_PRIVATE;

  /* yunjie: 这里省略了部分代码 */

  do
    {
        /* yunjie: 这里省略了部分代码 */

      /* Wait until woken by signal or broadcast.  */
      lll_futex_wait (&cond->__data.__futex, futex_val, pshared);

        /* yunjie: 这里省略了部分代码 */
      
      /* If a broadcast happened, we are done.  */
      if (cbuffer.bc_seq != cond->__data.__broadcast_seq)
    goto bc_out;

      /* Check whether we are eligible for wakeup.  */
      val = cond->__data.__wakeup_seq;
    }   
  while (val == seq || cond->__data.__woken_seq == val);

  /* Another thread woken up.  */  
  ++cond->__data.__woken_seq;

 bc_out:
    /* yunjie: 这里省略了部分代码 */
  return __pthread_mutex_cond_lock (mutex);
}
```
代码已经经过精简，但我们仍然直接把目光放到19行，lll_futex_wait，这是一个pthread内部宏，用处是调用系统调用sys_futex（futex是一种user mode和kernel mode混合mutex，这里不展开讲了），这个操作会将当前线程挂起休眠（马上我们将会到内核中一探究竟）

lll_futex_wait宏展开的全貌

```cpp
#define lll_futex_wake(futex, nr, private) \
  do {                                        \
    int __ignore;                                 \
    register __typeof (nr) _nr __asm ("edx") = (nr);                  \
    __asm __volatile ("syscall"                           \
              : "=a" (__ignore)                       \
              : "0" (SYS_futex), "D" (futex),                 \
            "S" (__lll_private_flag (FUTEX_WAKE, private)),       \
            "d" (_nr)                         \
              : "memory", "cc", "r10", "r11", "cx");              \
  } while (0)
```
可以看到，该宏的行为很简单，就是通过内嵌汇编的方式，快速调用syscall:SYS_futex，所以我们也不用再多费口舌，直接看kernel的实现吧

linux/kernel/futex.c

```cpp
SYSCALL_DEFINE6(futex, u32 __user *, uaddr, int, op, u32, val, 
        struct timespec __user *, utime, u32 __user *, uaddr2,
        u32, val3)
{
    struct timespec ts;
    ktime_t t, *tp = NULL;
    u32 val2 = 0; 
    int cmd = op & FUTEX_CMD_MASK;

    if (utime && (cmd == FUTEX_WAIT || cmd == FUTEX_LOCK_PI ||
              cmd == FUTEX_WAIT_BITSET)) {
        if (copy_from_user(&ts, utime, sizeof(ts)) != 0)
            return -EFAULT;
        if (!timespec_valid(&ts))
            return -EINVAL;

        t = timespec_to_ktime(ts);
        if (cmd == FUTEX_WAIT)
            t = ktime_add_safe(ktime_get(), t);
        tp = &t;
    }    
    /*   
     * requeue parameter in &#39;utime&#39; if cmd == FUTEX_REQUEUE.
     * number of waiters to wake in &#39;utime&#39; if cmd == FUTEX_WAKE_OP.
     */
    if (cmd == FUTEX_REQUEUE || cmd == FUTEX_CMP_REQUEUE ||
        cmd == FUTEX_WAKE_OP)
        val2 = (u32) (unsigned long) utime;

    return do_futex(uaddr, op, val, tp, uaddr2, val2, val3);
}
```
linux 2.5内核以后都使用这种SYSCALL_DEFINE的方式来实现内核对应的syscall（我这里阅读的是inux-2.6.27.62内核）， 略过一些条件检测和参数拷贝的代码，我们可以看到在函数最后调用了do_futex，由于这里内核会进行多个函数地跳转，我这里就不一一贴代码污染大家了

大致流程： pthread_cond_wait => sys_futex => do_futex => futex_wait （蓝色部分为内核调用流程）

futex_wait中的部分代码

```cpp
/* add_wait_queue is the barrier after __set_current_state. */                                
    __set_current_state(TASK_INTERRUPTIBLE);                                                      
    add_wait_queue(&q.waiters, &wait);                                                            
    /*                                                                                            
     * !plist_node_empty() is safe here without any lock.                                         
     * q.lock_ptr != 0 is not safe, because of ordering against wakeup.                           
     */                                                                                           
    if (likely(!plist_node_empty(&q.list))) {                                                     
        if (!abs_time)                                                                            
            schedule();                                                                           
        else {                                                                                    
            hrtimer_init_on_stack(&t.timer, CLOCK_MONOTONIC,                                      
                        HRTIMER_MODE_ABS);                                                        
            hrtimer_init_sleeper(&t, current);                                                    
            t.timer.expires = *abs_time;                                                          
                                                                                                  
            hrtimer_start(&t.timer, t.timer.expires,                                              
                        HRTIMER_MODE_ABS);                                                        
            if (!hrtimer_active(&t.timer))                                                        
                t.task = NULL;                                                                    
                                                                                                                                                                                                     
            /*                                                                                    
             * the timer could have already expired, in which                                     
             * case current would be flagged for rescheduling.                                    
             * Don&#39;t bother calling schedule.                                                     
             */                                                                                   
            if (likely(t.task))                                                                   
                schedule();                                                                       
                                                                                                  
            hrtimer_cancel(&t.timer);                                                             
                                                                                                  
            /* Flag if a timeout occured */                                                       
            rem = (t.task == NULL);                                                               
                                                                                                  
            destroy_hrtimer_on_stack(&t.timer);                                                   
        }                                                                                         
    }
```
以上是futex_wait的一部分代码，主要逻辑是将当前进程/线程的状态设为TASK_INTERRUPTIBLE（可被信号打断），然后将当前进程/线程加入到内核的wait队列（等待某种条件发生而暂时不会进行抢占的进程序列），之后会调用schedule，这是内核用于调度进程的函数，在其内部还会调用context_switch，在这里就不展开，但有一点可以肯定就是当前进程/线程会休眠，然后内核会调度器他还有时间片的进程/线程来抢占CPU，这样pthread_cond_wait就完成了一次CS
pthread_cond_signal的流程基本和pthread_cond_wait一致，这里都不再贴代码耽误时间

大致流程：pthread_cond_signal => SYS_futex => do_futex => futex_wake => wake_futex => __wake_up => __wake_up_common => try_to_wake_up （蓝色部分为内核调用流程）
try_to_wake_up()会设置一个need_resched标志，该标志标明内核是否需要重新执行一次调度，当syscall返回到user space或是中断返回时，内核会检查它，如果已被设置，内核会在继续执行之前调用调度程序，之后我们万能的schedule函数就会在wait_queue（还记得吗，我们调用pthread_cond_wait的线程还在里面呢）中去拿出进程并挑选一个让其抢占CPU，所以，根据我们跟踪的内核代码，pthread_cond_signal也会发生一次CS

 

## 本篇结束 -

会造成CS的函数远远不止这些，例如我们平时遇到mutex竞争，或是我们调用sleep时，都会发生，
我们总是忽略了它的存在，但它却默默地扼杀着我们的程序性能（相信我，它比你想象中要更严重），
在下一篇中我将以chaos库（我编写的一个开源网络库）中的一个多线程组件为例，给大家演示CS所带来的性能下降
希望对大家有帮助 ：）

 