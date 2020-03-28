---
layout: post
title:  FFLIB网络框架单线程0.0.1版本-epoll_socket
categories: fflib
tagline: FFLIB网络框架单线程0.0.1版本-epoll_socket
tags:
    - fflib
    - c++
    - socket
excerpt: >
    封装了epoll和socket
---

#### 问题：
 对于epoll_wait操作，何时将会触发EPOLLERR？
 服务器端close掉socket时候，如何保证EPOLLIN不会再触发，按理说close之后是不会有EPOLLIN，但是多线程时，有可能有EPOLLIN排在close后边
 执行，那么什么时候才能确定epoll_wait中再也不会有事件到来？因为这时候才能干净的将socket 对象delete掉。

![](/assets/img/fflibnetwork0.0.1/fflibnetwork0.0.11.jpg)

#### 代码仓库：
https://ffown.googlecode.com/svn/trunk

