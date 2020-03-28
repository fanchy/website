---
layout: post
title:  Boost::asio io_service 实现分析 
categories: tech
tagline: io_servie 实现了一个任务队列。
tags:
    - boost
    - ASIO
    - io_service
excerpt: >
    io_servie 实现了一个任务队列，这里的任务就是void(void)的函数。Io_servie最常用的两个接口是post和run，
    post向任务队列中投递任务，run是执行队列中的任务，
    直到全部执行完毕，并且run可以被N个线程调用。Io_service是完全线程安全的队列。
---

## Boost::asio io_service 实现分析

### io_service的作用
io_servie 实现了一个任务队列，这里的任务就是void(void)的函数。Io_servie最常用的两个接口是post和run，post向任务队列中投递任务，run是执行队列中的任务，直到全部执行完毕，并且run可以被N个线程调用。Io_service是完全线程安全的队列。

### Io_servie的接口
提供的接口有run、run_one、poll、poll_one、stop、reset、dispatch、post，最常用的是run、post、stop

### Io_servie 实现代码的基本类结构：
*  Io_servie是接口类，为实现跨平台，采用了策略模式，所有接口均有impl_type实现。根据平台不同impl_type分为
*  win_iocp_io_service Win版本的实现，这里主要分析Linux版本。
*  task_io_service 非win平台下的实现，其代码结构为：
*  detail/task_io_service_fwd.hpp 简单声明task_io_service名称
*  detail/task_io_service.hpp 声明task_io_service的方法和属性
*  detail/impl/task_io_service.ipp 具体实现文件
*  队列中的任务类型为opertioan，原型其实是typedef task_io_service_operation operation，其实现文件在detail/task_io_service_operation.hpp中，当队列中的任务被执行时，就是task_io_service_operation:: complete被调用的时候。

### Io_servie::Post方法的实现
Post向队列中投递任务，然后激活空闲线程执行任务。其实现流程如下：

*  Post接收handler作为参数，实际上是个仿函数，通过此仿函数构造出completion_handler对象，completion_handler继承自operation。然后调用post_immediate_completion。
*  post_immediate_completion首先将outstanding_work_增加，然后调用post_deferred_completion。
*  post_deferred_completion首先加锁将任务入列，然后调用wake_one_thread_and_unlock
*  wake_one_thread_and_unlock尝试唤醒当前空闲的线程，其实现中特别之处在于，若没有空闲线程，但是有线程在执行task->run，即阻塞在epoll_wait上，那么先中断epoll_wait执行任务队列完成后再执行epoll_wait。
*  first_idle_thread_维护了所有当前空闲线程，实际上使用了Leader/Follower模式，每次唤醒时只唤醒空闲线程的第一个。

### Io_servie::run方法的实现
Run方法执行队列中的所有任务，直到任务执行完毕。

*  run方法首先构造一个idle_thread_info，和first_idle_thread_类型相同，即通过first_idle_thread_将所有线程串联起来，它这个串联不是立即串联的，当该线程无任务可做是加入到first_idle_thread_的首部，有任务执行时，从first_idle_thread_中断开。这很正常，因为first_idle_thread_维护的是当前空闲线程。
*  加锁，循环执行do_one方法，直到do_one返回false
*  do_one每次执行一个任务。首先检查队列是否为空，若空将此线程追加到first_idle_thread_的首部，然后阻塞在条件变量上，直到被唤醒。
*  当被唤醒或是首次执行，若stopped_为true（即此时stop方法被调用了），返回0
*  队列非空，pop出一个任务，检查队列无任务那么简单的解锁，若仍有，调用wake_one_thread_and_unlock尝试唤醒其他空闲线程执行。然后执行该任务，返回1.
*  实际上在执行队列任务时有一个特别的判断if (o == &task_operation_)，那么将会执行task_->run，task_变量类型为reactor，在linux平台实现为epoll_reactor，实现代码文件为detail/impl/epoll_reactor.ipp，run方法实际上执行的是epoll_wait，run阻塞在epoll_wait上等待事件到来，并且处理完事件后将需要回调的函数push到io_servie的任务队列中，虽然epoll_wait是阻塞的，但是它提供了interrupt函数，该interrupt是如何实现的呢，它向epoll_wait添加一个文件描述符，该文件描述符中有8个字节可读，这个文件描述符是专用于中断epoll_wait的，他被封装到select_interrupter中，select_interrupter实际上实现是eventfd_select_interrupter，在构造的时候通过pipe系统调用创建两个文件描述符，然后预先通过write_fd写8个字节，这8个字节一直保留。在添加到epoll_wait中采用EPOLLET水平触发，这样，只要select_interrupter的读文件描述符添加到epoll_wait中，立即中断epoll_wait。很是巧妙。！！！实际上就是因为有了这个reactor，它才叫io_servie，否则就是一个纯的任务队列了。
*  Run方法的原则是：
*  有任务立即执行任务，尽量使所有的线程一起执行任务
*  若没有任务，阻塞在epoll_wait上等待io事件
*  若有新任务到来，并且没有空闲线程，那么先中断epoll_wait,先执行任务
*  若队列中有任务，并且也需要epoll_wait监听事件，那么非阻塞调用epoll_wait（timeout字段设置为0），待任务执行完毕在阻塞在epoll_wait上。
*  几乎对线程的使用上达到了极致。
*  从这个函数中可以知道，在使用ASIO时，io_servie应该尽量多，这样可以使其epoll_wait占用的时间片最多，这样可以最大限度的响应IO事件，降低响应时延。但是每个io_servie::run占用一个线程，所以io_servie最佳应该和CPU的核数相同。

### Io_servie::stop的实现
*  加锁，调用stop_all_threads
*  设置stopped_变量为true，遍历所有的空闲线程，依次唤醒
*  task_interrupted_设置为true，调用task_的interrupt方法
*  task_的类型为reactor，在run方法中已经做了分析
