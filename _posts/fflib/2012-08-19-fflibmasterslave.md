---
layout: post
title:  FFLIB 框架Broker 之Master/Slave 模式
categories: fflib
tagline: FFLIB 框架Broker 之Master/Slave 模式
tags:
    - fflib
    - c++
    - socket
    - master/slave
excerpt: >
    在Client 和 Service 节点不断增多的情况下，单个Broker 将会无法承载。所以本文将探究如何扩展FFLIB 。
---
## FFLIB 框架Broker 之Master/Slave 模式

在FFLIB的两篇介绍中，已经介绍了FFLIB是基于Broker模式构建的框架，核心组件关系图如下：

![](/assets/img/fflibmasterslave/fflibmasterslave1.jpg)

这种情况，比较明显的瓶颈是Broker 只有一个。在Client 和 Service 节点不断增多的情况下，单个Broker 将会无法承载。

所以本文将探究如何扩展FFLIB 。
其实解决之道也很直接，就是增加Broker 。
为了能够为FFLIB 增加Broker 节点， 参考了Mysql 中的Master/Slave 结构， 设计FFLIB 的多Broker 框架如下图：

![](/assets/img/fflibmasterslave/fflibmasterslave2.jpg)


Service 调用注册服务和接口时只通过Broker Master节点， Master将注册的服务和接口信息同步给所有的Slave节点，
而所有的Service 接口和Client 节点和Slave 都是有连接的，所以不同的Service 就实现了通过不同的Slave 完成消息转发，

实现了负载均衡。而且消息转发的开销和原来单个Broker的开销完全相同。

关于 Master 和 Slave 节点核心通信逻辑如下图所示：
![](/assets/img/fflibmasterslave/fflibmasterslave3.jpg)

## 总结：

*  Master/Slave 模式是可选的，但Broker 仍然是可以工作的。
*  源码 svn co http://ffown.googlecode.com/svn/trunk/
*  构建borker ： cd example/broker && make
*  开启Broker Master（默认就是Master）： ./app_broker –l tcp://127.0.0.1:10241
*  开启BrokerSlave ：./app_broker –l tcp://127.0.0.1:10242 -node slave –master_host  tcp://127.0.0.1:10241
*  构建Echo 测试Service ：cd example/echo_server && make && ./app_echo_server
*  构建 Echo 测试Client：dd example/echo_client && make && ./app_echo_client