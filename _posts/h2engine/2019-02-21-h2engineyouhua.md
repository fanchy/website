---
layout: post
title:  游戏服务器h2engine架构优化和跨平台设计
categories: h2engine
tagline: h2engine又更新了一下，感觉h2engine又向前迈了一大步。
tags:
    - boost
    - ASIO
    - socket
excerpt: >
    H2engine的GitHub星星不知不觉已经破百了，也没有特意推广过，但是慢慢的关注的人越来越多。
    因为事情多，好久没有写东西了，前一段时间有了一些想法，把h2engine又更新了一下，感觉h2engine又向前迈了一大步。
    本文记录一下最近的心得体会，以及做出的相应修改。
---
H2engine的GitHub星星不知不觉已经破百了，也没有特意推广过，但是慢慢的关注的人越来越多。因为事情多，好久没有写东西了，前一段时间有了一些想法，把h2engine又更新了一下，感觉h2engine又向前迈了一大步。本文记录一下最近的心得体会，以及做出的相应修改。


![](/assets/img/h2engineyouhua/h2engineyouhua1.jpg)

## 关于RPC
H2engine的rpc部分使用的是原来fflib的ffrpc组件，ffrpc设计的比较强大，但是因为h2engie的架构特点，ffrpc的一些功能用不到，很多网友都询问我关于rpc部分的设计问题，我仔细思考后觉得确实可以把h2engine的rpc部分进行简化，这样对于使用者而言更容易理解。
先看一下h2engine的架构：
 
*	H2engine设计的为单gate，单服环境内linux下一个gate完全能够满足性能要求，Apache/nigx都是一个进程不是吗？单gate让分布式的结构大大简化。我们知道一般单服架构都有个loginserver，现在可以省略了，因为单gate，每个服直接配置gate地址。
*	H2engine为多进程架构，但是h2engine限定了采用伪分布式的设计，虽然gate和gameserver通过网络通信，但是限定了gate和gameserver在一台机器上。虽然gate和gameserver放在不同机器上也可以通信，但是我们从现实运营的情况出发，很少运维会把gate和gameserver放不同机器上，一般有的时候一台机器上甚至有多个服。所以伪分布式是既能满足需求又能大大简化架构的一个设计。
*	采用伪分布式设计后，gameserver之间就可以利用共享内存了，全局的数据比如排行榜、行会、好友、组队等，这些模块都是分布式进程中最费时费力容易出错的，但是在h2engine里变得逻辑清晰，直接操作全局内存就可以了，全同步。
*	Rpc模块进行了简化，其实rpc通信分三种，gate调用gameserver接口，gameserver调用gate接口，和gameserver与gameserver之间调用，发现没，所有架构内rpc都需要通过gate，而且h2engine是单gate伪分布式（127.0.0.1速度飞起），那么整个rpc结构就变得非常清晰简单，感兴趣的可以看下gate的broker文件和rpc文件。这两个文件一个是gate端中转，一个是请求端封装，非常简洁。
*	网络层进行了升级，原来socket是裸的指针，很多网友还是表达了不知道什么时候应该调用safedelete的问题，所以还是改成了智能指针，不需要关系socket什么时候释放。另外socket的私有数据进行了泛型封装，可以存入任何私有数据类型。
共享内存的简单示意：

![](/assets/img/h2engineyouhua/h2engineyouhua2.jpg)

## 关于跨平台
h2engine一直是 只支持linux下编译，Windows的移植一直没有时间弄，虽然行业内大部分服务器都是跑linux的，但是如果可以Windows下可以开发调试，那对于提高平常的开发效率来说将会大有裨益。

h2engine由于一开始是在linux下gcc下开发的，那么在Windows下也用gcc，那么需要修改的跨平台代码将会非常少，本着这个思路，h2engine成功移植到了Windows，并且改动的非常少。
*	Windows下的虽然有mingw直接包含了gcc环境，但是想用上cmake等编译工具还是挺麻烦的，所以我找了一个集成mingw且算得上比较流行的一个Windows IDE：CodeBlocks。见了一个CodeBlocks的项目，想要在Windows下运行只要下载一个CodeBlocks，然后双击工程文件就可以了。
*	编译h2engine需要依赖openssl、curl、mysql、lua、python2.7，依赖文件都放到windependency文件夹里，包括运行的dll。
*	H2workerlua在Windows下用的lua5.1
*	H2workerpython在Windows下用的python2.7
注意：CodeBlocks调试需要安装python2.7，setting->debugger->default 里executable path设置为 C:\Program Files (x86)\CodeBlocks\MinGW\bin\gdb32.exe

##  关于C sharp
H2engine的c#版本正在紧锣密鼓的开发中，大家拭目以待。
相关连接
1.	文档 http://h2cloud.org
2.	源码 https://github.com/fanchy/h2engine

