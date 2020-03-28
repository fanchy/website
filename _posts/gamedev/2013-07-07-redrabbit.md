---
layout: post
title:  RedRabbit——基于BrokerPattern服务器框架
categories: gamedev
tagline: 经典网游服务器架构
tags:
    - 游戏服务器架构
    - 经典网游服务器架构
    - BrokerPattern服务器框架
    - 服务器c++
excerpt: >
    BrokerPattern服务器框架
---

### 经典网游服务器架构

![](/assets/img/redrabbit/redrabbit1.jpg)

该图省略了专门用途的dbserver、guildserver等用于专门功能的server，该架构的优点有：

* LoginGate相当于DNS，可以动态的保证GameGate之间负载均衡。
* 由于Clientt的逻辑操作都是由GameServer处理的，而Client的消息请求都被GameGate转发到GameServer上，所以在不同的GameGate上的client仍能出现在相同的场景里。若在不同的场景，又可以将其分布在不公的GameServer处理，从而实现了GameServer的Scalability。
* GameServer一般是由C++与脚本结合实现的。由于数据都是在内存中处理而且大部分的IO操作（网络、数据库等）都被异步化，所以保证了非常高的实时性。

### 缺点是：

* 各个节点之间通过socket进行异步通信，测试过程叫复杂。
* 各个节点往往都需要交互，这时就涉及到了谁连谁的问题，理解和设计架构的网络拓扑也变得不太容易，相应的配置也会叫繁琐，排错的难度也较大。
* GameServer由于是C++主语言实现，不免会涉及到崩溃和内存泄露问题，采用C++与脚本结合很大程度上缓解了这个问题，实际上越来越多的逻辑操作都是放到脚本中实现。
* 由于该架构必须正确的配置连接关系，否则不能正常工作，对于运维而言也并不轻松。
 

讨论完经典网游的服务器架构，今天的主题也呼之欲出了，但在此之前，先说一下该架构的核心思想，
如果你读过《面向模式的软件架构.第4卷,分布式计算的模式语言》你也许想到了BrokerPattern，其核心思想是通过Broker代理层，
促使Server的位置对于Client保持透明，client通过Broker找到对应的Server处理请求，Serverr是如何分布的、数量多少，

Client都不受影响。Broker可以存在两种模式，一种是类似于DNS提供的LookUp服务，它只是帮助Client定位到Server的位置，
Client直接连接到Serverr进行通信。LoginGate扮演的就是这种Broker。

另外一种Broker直接将Client请求投递给Serverr，GameGate就是扮演的这种Broker。总的来说BrokerPattern中，Broker具有如下功能：

* LookUp服务，帮助Client定位Server
* Route服务，实现Client和Server之间的消息转发
* 注册服务，Server必须要注册到Broker上这样Broker才能提供LookUp和Route功能。
BrokerPattern示意图：

![](/assets/img/redrabbit/redrabbit2.jpg)

 

所以今天的主题是如何利用BrokerPattern构建实时的服务器框架。

### RedRabbit目标：

* 节点之间通信采用异步消息、回调模式
* Server必须很容易注册到Broker上
* C++/EPOOL实现网络通信，保证实时性，支持逻辑层python实现，支持热更新
* 该框架能够容易的构建单个区组的构架
* 该框架支持跨区组通信，这也是Broker模式的优势，节点之间通信不需要知道对方的位置，只需要知道对方的名称

这个框架的名字叫RedRabbit。

#### FFRPC
首先介绍RedRabbit的通信组件ffrpc，ffrpc中有如下5种角色：

* BrokerMaster，负责管理所有的BrokerSlave，所有Slave需要注册到BrokerMaster上，BrokerMaster同步所有信息给所有节点。
* BrokerSlave负责转发Client和Service之间的消息。
* Client为调用Service接口的一方，它通过Broker于Service通信，Client不知道Service的具体位置，它只是知道当前与之通信的Service名称。
* Service提供给Client调用的接口，并把接口注册到Broker上，Service若调用了其他的Service的接口，则相对于其他Service其为Client角色。
* BrokerBridge负责桥接各个brokerMaster，每一个BrokerMaster负责一组服务，BrokerBridge使Client调用其他组接口和调用本组的接口一样容易，因为只需要指定对方服务名称即可。
各个角色示意图：

![](/assets/img/redrabbit/redrabbit3.jpg)

使用FFRPC实现的Echo服务实例代码：

http://www.cnblogs.com/zhiranok/archive/2013/06/06/ffrpc.html

### RedRabbit中的其他组件Gate和Scene
#### Gate
外网接入的client有些特殊，需要一定的安全处理。Gate是专门用于接入外部Client的组件。Gate的作用有：

* Client的第一个消息必须为验证消息，Gate 并没有验证Client的能力，它调用Scene@0的接口处理
* Scene@0通过验证后将Client将被分配唯一的SessionId。
* Client的所有消息都被Gate转发到对应的Scene上，Scene可以控制Gate接口切换某个Client到其他Scene上
* Gate提供转发消息、多播、广播、断开连接等接口公scene调用。

需要特别指出的是，Gate和Scene只是RedRabbit的组件，RedRabbit通过制定不同的启动参数来确定开启哪些组件。示例：

* ./app_redrabbit -gate gate@0 -broker tcp://127.0.0.1:10241 -gate_listen tcp://121.199.21.238:10242
* -gate 表示gate的名称，scene通过名称调用其接口
* -gate_listen表示gate监听的ip、port
* -brkoker表示作为BrokerMaster启动，一组服务中必须有一个BrokerMaster，如果Broker和Client和Service在同一进程中，Broker专门做了优化，消息会直接从内存间实现传递，避免了网络转发的开销。
#### Scene
在RedRabbit中的所有Service都是运行在Scene组件之下的。Scene提供了通用的接口，可以和Gate和其他Scene通信，并把接口导入到了python中。Scene接收的Client的请求都交由Python处理，所以可以用Scene+Python实现GameServer、DbServer等各种专用的服务器。Scene组件提供的功能有：

* 验证Client有效性，scene@0必须提供此接口
* 处理Client Enter消息，Scene第一次进入该Scene，触发此事件
* 处理Client Offline消息，Client下线，触发此事件
* Scene提供转发、多播、广播、关闭连接等接口给python
* Scene提供定时器接口给python
* Scene提供异步操作Mysql、Sqlite的接口，采用异步加回调，从而避免阻塞主线程
* Scene提供了一套消息派发框架，支持client和python通信的协议包括json、thrift、protobuf。
使用RedRabbit构建的聊天室demo示例：

http://ffown.sinaapp.com/flash/

修改名称，点击flash的连接按钮，进入聊天室发消息，右侧的python脚本为服务器python的实现，修改右侧脚本点保存按钮，在flash中输入reload即可实现热更新!!!!

该聊天室服务器启动的参数是:

./app_redrabbit -gate gate@0 -broker tcp://127.0.0.1:10241 -gate_listen tcp://121.199.21.238:10242 -python_path ./ -scene scene@0

该示例中把gate和scene启动到了一个服务器程序上，实际上通过调整参数，二者可以启动到不同进程中，RedRabbit通过参数开启组件，而组件之间是通过Broker建立联系的。

对应的python代码：

```python
# coding=UTF-8
import os
import time
import ffext

def GetNowTime():
    return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(time.time()))

class player_mgr_t(object):
    def __init__(self):
        self.all_players = {}
    def get(self, session_id_):
        return self.all_players.get(session_id_)
    def remove(self, session_id_):
        del  self.all_players[session_id_]
    def add(self, session_id_, player):
        self.all_players[session_id_] = player
    def size(self):
        return len(self.all_players)
    def idlist(self):
        return self.all_players.keys()

class player_t(object):
    def __init__(self, session_id_):
        self.session_id = session_id_;
    def id():
        return self.session_id

#这个修饰器的意思是注册process_chat函数接收cmd=1的消息
@ffext.session_call(1)
def process_chat(session_id, msg):
    content = msg[0]
    if content == 'reload':
        os.system('./update_code.sh')
        ret = ffext.reload('main')#重载此脚本
        ffext.broadcast_msg_session(1, '<b><font color="#ff0000"> main.py已完成重载'\
                                       '%s</font></b>'%(str(ret)))
        return

    print("process_chat session_id=%s content=%s"%(session_id, content))

    ret = '<font color="#008000">[%s %s]:</font>%s'%(session_id, GetNowTime(), content)
    ffext.broadcast_msg_session(1, ret)


#这个修饰器的意思是注册下面函数处理验证client账号密码，
#session_key为账号密码组合体，client第一个包必为登陆包
@ffext.session_verify_callback
def my_session_verify(session_key, online_time, ip, gate_name):
    return [session_key]#需要返回数组，验证成功，第一个元素为分配的id，
                        #第二个元素可以不设置，若设置gate会返回给client，login gate的时候
                        #需要第二个元素返回分配的game gate

#此修饰器的作用是注册下面函数处理用户下线 
@ffext.session_offline_callback
def my_session_offline(session_id, online_time):
    content = '<font color="#ff0000">[%s %s] offline </font>'%(session_id, GetNowTime())
    ffext.broadcast_msg_session(1, content)
    ffext.singleton(player_mgr_t).remove(session_id)
    ffext.broadcast_msg_session(1, '<font color="#ff0000">当前在线:</font>')
    ffext.broadcast_msg_session(1, ffext.singleton(player_mgr_t).idlist())

#此修饰器的作用是注册下面函数处理client切换到此场景服务器
@ffext.session_enter_callback
def my_session_enter(session_id, from_scene, extra_data):
    #单播接口
    ffext.send_msg_session(session_id, 1, '<font color="#ff0000">测试单播接口！欢迎你！'\
                                             '</font>')
    content = '<font color="#ff0000">[%s %s] online </font>'%(session_id, GetNowTime())
    ffext.broadcast_msg_session(1, content)
    player = player_t(session_id)
    ffext.singleton(player_mgr_t).add(session_id, player)
    ffext.broadcast_msg_session(1, '<font color="#ff0000">当前在线:</font>')
    ffext.broadcast_msg_session(1, ffext.singleton(player_mgr_t).idlist())

print("loading.......")                                                        
```
 

## 总结：
* Ffrpc是基于BrokerPattern思想实现的异步消息+回调通讯库。
* 使用python构建实时服务器完全可以做到，在一些页游和手游项目尤其适合。确保高实时性的建议一是把数据在内存中操作，二是io操作异步化。
* RedRabbit支持Client与Python的通信协议有Json、thrift、protobuf。我个人最喜欢thrift。
* RedRabbit支持跨区组通信，通过BrokerBridge把GroupA和GroupB的BrokerMaster连通起来。示例：
启动BrokerBridge：

./app_redrabbit  -broker tcp://127.0.0.1:10241

启动GroupA的BrokerMaster:

./app_redrabbit  -broker tcp://127.0.0.1:10242 -bridge_broker GroupA@tcp://127.0.0.1:10241

启动GroupB的BrokerMaster:

./app_redrabbit  -broker tcp://127.0.0.1:10242 -bridge_broker GroupB@tcp://127.0.0.1:10241

在GroupA的python中就可以这样调用GroupB的接口：

Ffext.bridge_call(‘GroupB’, cmd, msg, callback)

项目源码：

https://github.com/fanchy/RedRabbit

TODO:
构建跨服的demo示例, 下一篇。

 

更多精彩文章 http://h2cloud.org