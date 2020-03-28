---
layout: post
title:  FF ASIO 异步消息网络框架
categories: tech
tagline: 针对前面使用boost asio 中遇到的问题，对asio进行封装
tags:
    - boost
    - ASIO
    - socket
excerpt: >
    针对前面使用boost asio 中遇到的问题，对asio进行封装。
---

#### 我提到，针对前面使用boost asio 中遇到的问题，对asio进行封装，如下几个目标：

* 创建socket、acceptor不再自己构造io_service，由于asio中的对象均要保存io_service的引用，
　　若要手动构造，必须保证io_service晚于所有的asio对象（如socket、acceptor）释放，但是往往socket被逻辑层保存在某个内存深处，任意一个socket晚于　　　　io_service释放，将会引起崩溃。

* 编写分布式程序时，都是采用异步消息，但是asio 中对socket进行async_write不能保证线程安全，而且我们必须保证在单个socket上发送数据
　　必须是顺序的。

* io_service必须绑定线程才能运行，而每个asio socket都需要io_service，所以经常要手动为io_service创建线程，但是经过测试表明，网络io分配的线程配置
　　2-4个效率最佳，在增加线程并不能增大吞吐量，这是由于asio采用全异步模式。所以我们只需要开启两个专门的线程给asio的io_service用即可，
　　省了在关心线程的分配。
* 在编写分布式程序中，变的往往只是逻辑层，网络框架、消息协议基本不怎么变化，所以网络框架必须能够保证逻辑层的接口足够灵活。在基于消息模式
　　通讯的框架下，每个程序需要单独定制自己的消息派发策略。
* 如果新增加支持的消息协议，必须保证无需重写框架，而且保证原来的消息派发策略仍然有效。

#### 目前ff_lib已经能够很好的支持以上几点。

其类关系如图：
![](/assets/img/asioframework/asioframework1.jpg)


