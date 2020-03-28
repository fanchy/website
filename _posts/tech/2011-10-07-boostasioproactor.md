---
layout: post
title:  Boost ASIO proactor 浅析
categories: tech
tags:
    - boost
    - ASIO
    - io_service
tagline: ASIO在Linux平台下的实现基于epoll，但是epoll只支持reactor模式，ASIO通过封装在epoll上实现了proactor。。
excerpt: >
    Boost asio 的socket的异步非阻塞模式才有的是proactor模式，当IO操作介绍后回调相应的处理函数。
    ASIO在Linux平台下的实现基于epoll，但是epoll只支持reactor模式，ASIO通过封装在epoll上实现了proactor。
    提到ASIO proactor，ASIO中的所有异步操作都是基于io_service实现的，io_service是ASIO中的任务队列，
    并且他负责调用epoll_wait等待IO事件到来。
---

### 前情提要：
Boost asio 的socket的异步非阻塞模式才有的是proactor模式，当IO操作介绍后回调相应的处理函数。
ASIO在Linux平台下的实现基于epoll，但是epoll只支持reactor模式，ASIO通过封装在epoll上实现了proactor。
提到ASIO proactor，ASIO中的所有异步操作都是基于io_service实现的，io_service是ASIO中的任务队列，
并且他负责调用epoll_wait等待IO事件到来，对io_service的实现参加前边的blog：[Boost::asio io_service 实现分析](./boostioservice.html).

### Proactor 和 Rector：
两种设计模式网上已经有很多种解释，这两种模式都是针对IO操作的，我的理解是Rector只是告诉调用者什么时候事件到来，
但是需要进行什么操作，需要调用者自己处理。Preactor不是当事件到来时通知，而是针对此事件对应的操作完成时，
通知调用者，一般通知方式都是异步回调。举例，Reactor中注册读事件，那么文件描述符可读时，
需要调用者自己调用read系统调用读取数据，若工作在Preactor模式，注册读事件，同时提供一个buffer用于存储读取的数据，
那么Preactor通过回调函数通知用户时，用户无需在调用系统调用读取数据，因为数据已经存储在buffer中了。显然epoll是Reactor的。

### ASIO 的实现：
#### Epoll的封装：
* boost/asio/detail/epoll_reactor.hpp 是epoll_reatcor的封装，class epoll_reactor有两个作用，任务队列和调用epoll_wait，支持的操作类型有read、write、connect、except。其实现文件为boost/asio/etail/impl/epoll_reactor.ipp，主要的实现逻辑有run和start_op。
* Run函数的逻辑是：调用一次epoll_wait，得到相应的IO事件
* 遍历相应IO事件，若是专门用于中断epoll操作的文件描述符那么跳过
* 若是用于定时器的文件描述符，则设置标志变量check_timers为true
* 若是基本IO事件，依次检查其IN、OUT事件，except事件会首先检测，将次事件对应的队列上的操作全部执行完毕（先调用io_servie::post，然后被调用）。
* 若check_timers标志变量被设置，那么将已经超时的操作通过io_service::post调用
* start_op的实现：
* Start_op需要事件的类型、文件描述符、回调函数做参数，首先调用perform，也就是直接send，send若成功直接调用io_service::post调用回调函数
* 如果文件描述符没有注册到epoll_wait，那么EPOLLIN \| EPOLLERR \| EPOLLHUP \| EPOLLOUT \| EPOLLPRI \| EPOLLET 全部注册到epoll_wait。
* 每个文件描述符有自己的队列，该事件的回调函数会被添加到队列中。

#### boost::asio::ip::tcp::socket中的异步方法的实现
* Socket中有async_打头的许多异步方法，这里已async_send为例
* boost/asio/ip/tcp.hpp 声明了tcp::socket的原型，实际原型是
    typedef basic_stream_socket<tcp> socket;
* basic_stream_socket是模板类，声明在boost/asio/basic_stream_socket.hpp文件中，async_send操作只是简单的为
    this->service.async_send(this->implementation, buffers, 0, handler);

#### 而service的原型是什么呢？

basic_stream_socket继承于basic_socket<Protocol, stream_socket_service>，
而	stream_socket_service声明文件为boost/asio/stream_socket_service.hpp，L60中

typedef detail::reactive_socket_service<Protocol> service_impl_type;

告诉我们service的原	型是detail::reactive_socket_service<tcp>，其声明文件为
boost/asio/detail/reactive_socket_service.hpp
#### async_send操作实现逻辑为：

* 先分配一个回调函数，调用start_op，start_op的实现在detail/reactive_socket_service_base.ipp文件中，
只是简单的向epoll_reactor调用start_op方法注册write_op。start_op在上面的段落中已经讲到了。

