---
layout: post
title:  多核环境下编写程序需注意cache【转载】
categories: tech
tagline: 多核环境下编写程序需注意cache【转载】
tags:
    - 多核
    - 多线程
    - cache
excerpt: >
    前阵子接触到一道关于数组内部链表(多用于内存池技术)的数据结构的题, 这种数据结构能够比普通链表在cache中更容易命中, 理由很简单, 就是因为其在地址上是连续的(=.=!), 借这个机会, 就对cpu cache进行了一个研究, 今天做一个简单的分享, 首先先来普及一下cpu cache的知识, 这里的cache是指cpu的高速缓存. 在我们程序员看来, 缓存是一个透明部件. 因此, 程序员通常无法直接干预对缓存的操作. 但是, 确实可以根据缓存的特点对程序代码实施特定优化, 从而更好地利用高速缓存. 
    高速缓存的置换策略会尽可能地将访问频繁的数据放入cache中, 这是一个动态的过程, 所以cache中的数据不会一直不变. 目前一般的机器的cpu cache可分为一级缓存和二级缓存. 一级缓存更靠近cpu, 速度比二级缓存更快. 二级缓存比一级缓存速度更慢, 容量更大, 主要就是做一级缓存和内存之间数据临时交换的地方用.
---

### 介绍
前阵子接触到一道关于数组内部链表(多用于内存池技术)的数据结构的题, 这种数据结构能够比普通链表在cache中更容易命中, 理由很简单, 就是因为其在地址上是连续的(=.=!), 借这个机会, 就对cpu cache进行了一个研究, 今天做一个简单的分享, 首先先来普及一下cpu cache的知识, 这里的cache是指cpu的高速缓存. 在我们程序员看来, 缓存是一个透明部件. 因此, 程序员通常无法直接干预对缓存的操作. 但是, 确实可以根据缓存的特点对程序代码实施特定优化, 从而更好地利用高速缓存. 
高速缓存的置换策略会尽可能地将访问频繁的数据放入cache中, 这是一个动态的过程, 所以cache中的数据不会一直不变. 目前一般的机器的cpu cache可分为一级缓存和二级缓存. 一级缓存更靠近cpu, 速度比二级缓存更快. 二级缓存比一级缓存速度更慢, 容量更大, 主要就是做一级缓存和内存之间数据临时交换的地方用.
这两者和RAM在空间和效率上的关系如下:
```
L1 Cache---> L2 Cache ---> RAM
------------> 容量递增 ------------>
------------> 速度递减 ------------>
-----> CPU访问优先级递减 ----->
```

在linux系统中, 我们可以使用cat /proc/cpuinfo 来获知机器的cpu和核数.
而cpu cache的信息, 我们通过dmesg | grep cache来获知.
例如:
```
CPU: L1 I Cache: 64K (64 bytes/line), D cache 64K (64 bytes/line)
CPU: L1 I Cache: 64K (64 bytes/line), D cache 64K (64 bytes/line)
```
说明我这台机器有两个处理器, 并只有一级缓存, 大小为 64K, 缓存行/快 大小为64 bytes.
 
由于不同的处理器之间都具有自己的高速缓存, 所以当两个cpu的cache中都存有数据a, 那么就有可能需要进行同步数据, 而cache之间同步数据的最小单元为cache行大小, 可以把一个cache想象成一张表, 表的每一行都是64bytes(假设), 当cpu被告知cache第一行的第一个byte为脏数据时, cpu会将第一行都进行同步.
例如以下场景:
*  CPU1读取了数据a(假设a小于cache行大小),并存入CPU1的高速缓存.
*  CPU2也读取了数据a,并存入CPU2的高速缓存.
*  CPU1修改了数据a, a被放回CPU1的高速缓存行. 但是该信息并没有被写入RAM.
*  CPU2访问a, 但由于CPU1并未将数据写入RAM, 导致了数据不同步.

为了解决这个问题, 芯片设计者制定了一个规则. 当一个CPU修改高速缓存行中的字节时, 计算机中的其它CPU会被通知, 它们的高速缓存将视为无效. 于是, 在上面的情况下, CPU2发现自己的高速缓存中数据已无效, CPU1将立即把自己的数据写回RAM, 然后CPU2重新读取该数据. 这样就完成了一次两个cpu之间cache的同步.
为了测试上述场景, 我编写了如下程序进行测试:

```cppp
#include<sys/types.h> 
#include<sys/sysinfo.h> 
#include <sys/time.h>
#include<unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>

#include <iostream>
using namespace std;

#define ENABLE_WHCIH_CPU
#define ENABLE_SET_CPU

#define EXEC_COUNT (100 * 1000 * 1000)

struct  bits_t
{
inta;
    char            placeholder[64];
int b;
};

struct bits_t bits;

int which_cpu(const char* prefix_)
{
    #ifdef ENABLE_WHCIH_CPU
cpu_set_t cur_cpu;
CPU_ZERO(&cur_cpu);
if (sched_getaffinity(0, sizeof(cur_cpu), &cur_cpu) == -1) 
{ 
printf("warning: cound not get cpu affinity, continuing...\n"); 
return -1;
} 
int num = sysconf(_SC_NPROCESSORS_CONF);
for (int i = 0; i < num; i++) 
{ 
if (CPU_ISSET(i, &cur_cpu)) 
{ 
printf("[%s] this process %d is running processor : %d\n", prefix_, getpid(), i); 
} 
} 
    #endif

return 0;
}

int set_cpu(int cpu_id_)
{
    #ifdef ENABLE_SET_CPU
cpu_set_t mask;
CPU_ZERO(&mask); 
CPU_SET(cpu_id_, &mask); 
if (sched_setaffinity(0, sizeof(mask), &mask) == -1) 
{ 
printf("warning: could not set CPU affinity, continuing...\n"); 
return -1;
    } 
    #endif

return 0;
}

void* thd_func1(void* arg_)
{
set_cpu(0);
which_cpu("thread 1 start");
    timeval begin_tv;
    gettimeofday(&begin_tv, NULL);

    for (int i = 0; i < EXEC_COUNT; i++)
    {
        bits.a += 1;
        int a = bits.a;
    }

    timeval end_tv;
    gettimeofday(&end_tv, NULL);
    printf("thd1 perf:[%lu]us\n", (end_tv.tv_sec * 1000 * 1000 + end_tv.tv_usec) - (begin_tv.tv_sec * 1000 * 1000 + begin_tv.tv_usec));
which_cpu("thread 1 end");

    return NULL;
}

void* thd_func2(void* arg_)
{
set_cpu(1);
which_cpu("thread 2 start");
    timeval begin_tv;
    gettimeofday(&begin_tv, NULL);

    for (int i = 0; i < EXEC_COUNT; i++)
    {
        bits.b += 2;
        int b = bits.b;
    }

    timeval end_tv;
    gettimeofday(&end_tv, NULL);
    printf("thd2 perf:[%lu]us\n", (end_tv.tv_sec * 1000 * 1000 + end_tv.tv_usec) - (begin_tv.tv_sec * 1000 * 1000 + begin_tv.tv_usec));
which_cpu("thread 2 end");

    return NULL;
}


int main(int argc_, char* argv_[])
{
int num = sysconf(_SC_NPROCESSORS_CONF);
printf("system has %d processor(s).\n", num);
cpu_set_t cpu_mask;
cpu_set_t cur_cpu_info;

memset((void*)&bits, 0, sizeof(bits_t));
set_cpu(0);
which_cpu("main thread");

    pthread_t pid1;
    pthread_create(&pid1, NULL, thd_func1, NULL);

    pthread_t pid2;
    pthread_create(&pid2, NULL, thd_func2, NULL);

    pthread_join(pid1, NULL);
    pthread_join(pid2, NULL);

    return 0;
}
```

该程序中会创建两个线程, 分别对全局变量bits的a和b成员进行1亿次加法操作.
在这里我分别针对四种情况进行了测试 -
*  两个线程分别跑在不同的cpu上, bits_t结构体没有placeholder这64个填充字节.
*  两个线程分别跑在不同的cpu上, bits_t结构体有placeholder这64个填充字节.
*  两个线程分别跑在相同的cpu上, bits_t结构体没有placeholder这64个填充字节.
*  两个线程分别跑在相同的cpu上, bits_t结构体有placeholder这64个填充字节.

程序可以通过set_cpu函数来将线程绑定到指定的cpu上去.
为了大家阅读的方便, 我已将测试结果报告整理成以下四个表格.

#### 情况一测试结果:
```
 线程id	 CPU绑定	 有无placeholder	 平均耗时(微妙)
 1	 cpu0	 无	 2186931
 2	 cpu1	 无	 2033496   
```
#### 情况二测试结果:
```
线程id	 CPU绑定	 有无placeholder	 平均耗时(微妙)
 1	 cpu0	 有	 402144
 2	 cpu1	 有	 392745 
``` 
我们先来看情况一和情况二的结果对比, 显然, 后者要比前者效率高得多的多, 可以验证在有 placeholder填充字节之后, bit_t的a和b域被划分到了cache的不同两行, 所以当在cpu0执行的线程1修改a后, cpu1在读b时, 不需要去同步cache. 而情况一因为a和b在cache中的同一行, 导致两个cpu要互相进行大量的cache行同步.

#### 情况三测试结果:
```
线程id	 CPU绑定	 有无placeholder	 平均耗时(微妙)
 1	 cpu0	 无	 716056
 2	 cpu0	 无	 686804   
``` 
#### 情况四测试结果:
```
线程id	 CPU绑定	 有无placeholder	 平均耗时(微妙)
 1	 cpu0	 有	 761421
 2	 cpu0	 有	 884969
```

可以看出, 情况三和四, 因为两个线程运行在同一个cpu上, 有和没有placeholder填充字节在性能上几乎没有什么区别, 因为不存在cache之间行同步的问题, 但是由于是一个cpu在调度切换两个线程, 所以要比情况一慢一点.
从上面测试结果看来, 某些特定情况下, 对于cache的优化还是很重要的, 但是也不能一味地为了追求性能都将所有共享数据加入填充字节, 毕竟cache就那么大, 如果不是某些特定的读写非常频繁的场景下, 没有必要这么做.
PS: 由于不同的硬件架构体系之间会有差别, 例如某些硬件架构同一个cpu下的两个物理核之间共享cache, 所以测试时要试具体环境而定.