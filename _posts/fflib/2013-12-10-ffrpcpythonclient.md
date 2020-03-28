---
layout: post
title:  FFrpc python客户端lib
categories: fflib
tagline: Ffrpc可以很方便的构建c++ server， 在网游服务器程序开发中，进程间通讯非常的重要
tags:
    - fflib
    - c++
    - socket
    - rpc
    - python socket
excerpt: >
    Ffrpc可以很方便的构建c++ server， 在网游服务器程序开发中，进程间通讯非常的重要，比如gateserver和gameserver或dbserver之间的通信。而ffrpc可以使得进程间通信非常简单
---

## 摘要:
Ffrpc可以很方便的构建c++ server， 在网游服务器程序开发中，进程间通讯非常的重要，比如gateserver和gameserver或dbserver之间的通信。
而ffrpc可以使得进程间通信非常简单，是由于ffrpc的broker模式封装了位置无关性，使得如gate调用gameserver的接口只需要知道对方的服务名，
从而使得程序中各个节点的关系与系统的拓扑关系是完美吻合的。这也使得系统的架构更加清晰，系统的实现更健壮和易维护。

之前ffrpc只提供了c++ server/client的实现，在网游服务器程序开发中经常有些需求是需要其他语言和C++server通信的，比如一些工具程序，
一些web配置、管理后台登通常用脚本语言实现更加敏捷。

比如开发一个gm后台，就可以使用python开发一个web页面实现，
而gm后台指令需要发给c++ server去执行。所以，脚本语言对于C++ server的的接口调用的需求是确实存在的。
所以ffrpc中提供python的客户端礼库ffrpc-py。

### 特性
*  C++ server 通常是使用二进制协议传输数据的，但是如果手动用python组二进制包则非常的困难，好在有google protobuf和thrift两大神器，而google protobuf在服务器程序开发领域已经被广泛接受。所以由于C++ server定义接口时使用了protobuf（或者像我一样偏爱thrift），那么与脚本通讯就变得小轻松了。
*  对于C++ server 来讲，通信时异步的，这是由于C++ server一般是逻辑层单线程，为了保持高并发能力，io操作异步化是必然选择。但是对于脚本如python这种，一般而言还是使用同步调用模型，而刚好ffrpc的通信模式要求所有的接口都是req<->ret一一对应的，ffrpc-py调用c++ server的接口，只需要制定输入消息，然后调用接口，接收返回消息，像调用本地函数一样直接，这也是rpc lib的存在意义。
*  Ffrpc-py 支持protobuf和thrift，当然必须和c++ server采用的通信协议一致。
#### 示例
本例采用c++ sever thrift作为示例。由于ffrpc example目录的tutorial已经实现了一个c++ echo server，本例就利用ffrpc-py调用echo接口。
其中thrift的定义文件为:

```
struct echo_thrift_in_t {      
  1: string data
}

struct echo_thrift_out_t {      
  1: string data
}
```
 
使用ffrpc-py调用echo接口:
```python
    HOST = '127.0.0.1'
    PORT = 10246
    ffc = ffclient_t(HOST, PORT, 1.5) # 1.5 sec为调用超时时间

    req = ttypes.echo_thrift_in_t('ohNice')
    ret = ttypes.echo_thrift_out_t()
    ffc.call('echo', req, ret, 'ff')

    print('error_info = %s' %(ffc.error_msg()), ret)
```

#### ffrpc接口的参数的解释：

*  ffclient_t(HOST, PORT, 1.5) 构造函数的参数为broker的监听地址和端口。Ffrpc-py只需要知道broker的位置，至于调用的是哪个服务器的接口，这个由broker确定，至于目标服务器是跟broker在同一个进程，还是通过网络连接，ffrpc-py无需知道细节。
*  call 接口调用远程的服务器接口，参数一为c++server接口注册的服务名，ffrpc-py只需要知道服务名就可以定位目标服务器的位置
*  call第二个参数为请求参数
*  call第三个参数为c++ server返回的消息类型，如果call返回true，那么该消息会被自动赋上值
*  第四个参数为消息的命名空间，比如定义thrift的文件的时候定义了命名空间，那么需要第四个参数填入命名空间，这里跟C++ server的注册的消息一致即可，如果C++ server也没有消息的命名空间，那么省略这个参数即可
*  Call接口成功返回True，失败为false，同时error_msg接口可以输出错误原因
## 总结
*  Ffrpc提供了python lib，可以实现py与c++ server的通信，这样利用python编写工具、后台都更加方便了。
*  同时ffrpc将会对于php进行支持，相应的client lib 不久就会开放出来。
*  Github: https://github.com/fanchy/FFRPC
*  c++ server 的实现介绍参见上一篇：http://www.cnblogs.com/zhiranok/p/ffrpc_client_server.html
更多精彩文章 http://h2cloud.org