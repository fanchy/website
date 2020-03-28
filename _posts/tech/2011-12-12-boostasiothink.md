---
layout: post
title:  Boost asio 心得笔记
categories: tech
tagline: Boost asio 心得笔记
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
#### Boost asio中有两点用的不爽:

1. asio中的所有对象都引用io_service
2. async_write还要自己保证内存在completed之前有效

 
### 有空要把这两点搞的更傻瓜一点，实际上在全异步模式下NET IO分配两个线程足矣，async搞一个队列，completed时候删掉，
还可以通过writev优化写, 现在在做的一个redrabbit lib

就是在boost asio上封装的更傻瓜一点。
如果再有空，想自己封装一下epoll， 不考虑移植性，很少的模板，比较简单的类关系，
看了一下asio 源码，其思路不是很复杂，但是为考虑移植性，使用了大量的模板和ifdef，可读性稍差，

我常常意识到，即使使用boost asio这样的proactor模式的io库，TCP编程仍然还是复杂，需要了解好多技术细节，
个人觉得ZeroMQ是个非常好的思路，http://www.zeromq.org/
每个项目花一两个月写tcp模块真是太蛋疼了，
要是能在巨人的肩膀上，不是更好。
