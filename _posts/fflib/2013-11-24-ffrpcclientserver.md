---
layout: post
title:  FFRPC应用之Client/Server
categories: fflib
tagline: Ffrpc 进行了重构，精简了代码，代码更加清晰简洁，几乎完美的达到了我的预想。
tags:
    - fflib
    - c++
    - socket
    - rpc
    - 游戏服务器rpc
    - protobuf
    - thrift
excerpt: >
    Ffrpc 进行了重构，精简了代码，代码更加清晰简洁，几乎完美的达到了我的预想。接下来将写几遍文章来介绍ffrpc可以做什么。简单总结ffrpc的特性
---

## 摘要：
Ffrpc 进行了重构，精简了代码，代码更加清晰简洁，几乎完美的达到了我的预想。接下来将写几遍文章来介绍ffrpc可以做什么。简单总结ffrpc的特性是：

*  Ffrpc是c++ 网络通信库
*  全异步 + 回调函数 机制
*  支持普通二进制协议、protobuf、thrift
*  基于Broker模式设计
*  设计精巧，代码量小，核心ffrpc的代码只有1000行
*  接口的性能监控是集成式的，使用者自动获得了接口性能数据，方便优化接口

### 普通二进制协议示例
Ffrpc实现了一个最基本的二进制序列化方法，基本的原理就是如果是固定长度那么就直接拷贝，如果是字符串，就先拷贝长度再拷贝内容。所以只支持向后扩展字段，对其他语言支持也不方便，但如果只是c++语言间传递消息，则显得非常的方便和高效。比如网游服务器中各个进程的通信可以采用这种最简单的二进制协议。Ffrpc中定义了一个工具类ffmsg_t来定义二进制消息.

消息定义:
```cpp
struct echo_t
{
    struct in_t: public ffmsg_t<in_t>
    {
        void encode()
        {
            encoder() << data;
        }
        void decode()
        {
            decoder() >> data;
        }
        string data;
    };
    struct out_t: public ffmsg_t<out_t>
    {
        void encode()
        {
            encoder() << data;
        }
        void decode()
        {
            decoder() >> data;
        }
        string data;
    };
};
```
 

读者可以看到，ffmsg_t中提供了流式的序列化方法，使得序列化变得很容易。设计服务器消息的时候,需要注意的点有:

*  在设计服务器接口的时候，每个接口接受一个消息作为参数，一个处理完毕返回一个消息，这是最传统的rpc模式。Ffrpc中采用这样的设计理念以简化和规范化接口设计。如果使用ffmsg_t定义消息，本人推荐的定义风格类似上面的代码这样。上面定义的是echo接口的输入消息和输出消息，但是都定义在echo_t结构内可以清晰的表明这是一对接口消息。
*  传统的服务器接口会为每个接口定义一个cmd,然后通过cmd反序列化成特定的消息调用特定的接口,ffrpc省略了cmd的定义,而是直接采用消息名称作为cmd,比如在ffrpc中注册的接口接受echo_t的消息,那么收到echo_t的消息自然而言的是调用这个接口
*  接口定义的时候必须的同时制定输入消息和输出消息
*  Ffmsg_t支持普通类型，字符串类型、stl类型。
echo服务的实现代码:
 
```cpp
struct echo_service_t
{
    //! echo接口，返回请求的发送的消息ffreq_t可以提供两个模板参数，第一个表示输入的消息（请求者发送的）
    //! 第二个模板参数表示该接口要返回的结果消息类型
    void echo(ffreq_t<echo_t::in_t, echo_t::out_t>& req_)
    {
        echo_t::out_t out;
        out.data = req_.msg.data;
        LOGINFO(("XX", "foo_t::echo: recv %s", req_.msg.data.c_str()));

        req_.response(out);
    }
};
echo_service_t foo;
    //! broker客户端，可以注册到broker，并注册服务以及接口，也可以远程调用其他节点的接口
    ffrpc_t ffrpc_service("echo");
    ffrpc_service.reg(&echo_service_t::echo, &foo);

    if (ffrpc_service.open(arg_helper))
    {
        return -1;
}
```
 

这样就定义了echo服务，echo服务提供了一个接口，接受echo_t::in_t消息，返回echo_t::out_t消息。由此可见使用ffrpc定义服务的步骤是：

#### 定义消息和接口
将接口注册到ffrpc的示例中，ffpc提供了reg模板方法，会自动的分析注册的接口使用神马输入消息，从而保证如果echo_t::in_t消息到来一定会调用对应的接口

Ffrpc工作的核心是broker，简单描述broker的作用就是转发消息。Ffrpc的client和server是不直接连接的，而是通过broker转发消息进行通信。这样的好处是server的位置对于client是完全透明的，这也是broker模式最精髓的思想。所以ffrpc天生就是scalability的。Ffrpc的client比如要调用echo服务的接口，完全不需要知道serverr对应的位置或者配置，只需要知道echo服务的名字。有人可能担忧完全的broker转发可能会带来很大开销。Broker保证了消息转发的最佳优化，如果client或者server和broker在同一进程，那么消息直接是内存间传递的，连序列化都不需要做，这也是得益于broker模式，broker模式的特点就是拥有很好的scalability。这样无论是简单的设计一个单进程的server还是设计成多进程分布式的一组服务，ffrpc都能完美胜任。
#### 调用echo服务的client示例：
```cpp
struct echo_client_t
{
    //! 远程调用接口，可以指定回调函数（也可以留空），同样使用ffreq_t指定输入消息类型，并且可以使用lambda绑定参数
    void echo_callback(ffreq_t<echo_t::out_t>& req_, int index, ffrpc_t* ffrpc_client)
    {
        if (req_.error())
        {
            LOGERROR(("XX", "error_msg <%s>", req_.error_msg()));
            return;
        }
        else if (index < 10)
        {
            echo_t::in_t in;
            in.data = "helloworld";
            LOGINFO(("XX", "%s %s index=%d callback...", __FUNCTION__, req_.msg.data.c_str(), index));
            sleep(1);
            ffrpc_client->call("echo", in, ffrpc_ops_t::gen_callback(&echo_client_t::echo_callback, this, ++index, ffrpc_client));
        }
        else
        {
            LOGINFO(("XX", "%s %s %d callback end", __FUNCTION__, req_.msg.data.c_str(), index));
        }
    }
};
ffrpc_t ffrpc_client;
    if (ffrpc_client.open(arg_helper))
    {
        return -1;
    }
    
    echo_t::in_t in;
    in.data = "helloworld";
    echo_client_t client;
　　ffrpc_client.call("echo", in, ffrpc_ops_t::gen_callback(&echo_client_t::echo_callback, &client, 1, &ffrpc_client));
```
 

使用ffrpc调用远程接口，只需要制定服务名和输入消息，broker自动定位echo服务的位置，本示例中由于ffrpc的client和server在同一进程，那么自动通过内存间传递，如果server和broker在同一进程，而client在其他进程或者物理机上，则broker和server之间的传递为内存传递，broker和client的消息传递为tcp传输，这就跟自己写一个tcp的server收到消息投递给service的接口，然后将消息再通过tcp投递给client。但是必须看到，ffrpc完全简化了tcp server定义，并且更加scalability，甚至完全可以用来进程内多线程的通讯。

需要注意的是，ffrpc拥有良好的容错能力，如果服务不存在或者接口不存在或者异常等发生回调函数仍然是会被调用，并且返回错误信息，从而使错误处理变得更加容易。比如游戏服务器中client登入gate但是scene可能还没有启动的时候，这里就能够很好的处理，回调函数检查错误就可以了。对于回调函数，对于经常使用多线程和任务队列的开发者一定非常熟悉，回调函数支持lambda参数应该算是锦上添花，使得异步的代码变得更加清晰易懂。

#### Broker的启动方式：
```cpp
　　int main(int argc, char* argv[])
　　{
　　    //! 美丽的日志组件，shell输出是彩色滴！！
　　    LOG.start("-log_path ./log -log_filename log -log_class XX,BROKER,FFRPC -log_print_screen true -log_print_file false -log_level 3");
　　
　　    if (argc == 1)
　　    {
　　        printf("usage: %s -broker tcp://127.0.0.1:10241\n", argv[0]);
　　        return 1;
　　    }
　　    arg_helper_t arg_helper(argc, argv);
　　
　　    //! 启动broker，负责网络相关的操作，如消息转发，节点注册，重连等
　　
　　    ffbroker_t ffbroker;
　　    if (ffbroker.open(arg_helper))
　　    {
　　        return -1;
　　    }
　　
　　    sleep(1);
　　    if (arg_helper.is_enable_option("-echo_test"))
　　    {
　　        run_echo_test(arg_helper);        
　　    }
　　    else if (arg_helper.is_enable_option("-protobuf_test"))
　　    {
　　        run_protobuf_test(arg_helper);
　　    }
　　    else
　　    {
　　        printf("usage %s -broker tcp://127.0.0.1:10241 -echo_test\n", argv[0]);
　　        return -1;
　　    }
　　
　　    ffbroker.close();
　　    return 0;
　　}
```
 

Ffrpc中两个关键的组件broker和rpc，broker负责转发和注册服务器，rpc则代表通信节点，可能是client可能是server。即使是多个服务器，只需要broker一个监听的端口，其他的服务只需要提供不同的服务名即可。

### Protobuf协议示例
Ffrpc 良好的设计抽离了对于协议的耦合，使得支持protobuf就增加了10来行代码。当然这也是由于protobuf生成的消息都继承message基类。当我实现thrift的时候，事情就稍微麻烦一些，thrift生成的代码更加简洁，但是生成的消息不集成基类，需要复制粘贴一些代码。

Protobuf的定义文件:
```
package ff;

message pb_echo_in_t {
  required string data = 1;
}
message pb_echo_out_t {
  required string data = 1;
}
```
 

我们仍然设计一个echo服务，定义echo接口的消息，基于ffrpc的设计理念，每个接口都有一个输入消息和输出消息。

### Echo服务的实现代码:
```cpp
struct protobuf_service_t
{
    //! echo接口，返回请求的发送的消息ffreq_t可以提供两个模板参数，第一个表示输入的消息（请求者发送的）
    //! 第二个模板参数表示该接口要返回的结果消息类型
    void echo(ffreq_t<pb_echo_in_t, pb_echo_out_t>& req_)
    {
        LOGINFO(("XX", "foo_t::echo: recv data=%s", req_.msg.data()));
        pb_echo_out_t out;
        out.set_data("123456");
        req_.response(out);
    }
};
protobuf_service_t foo;
    //! broker客户端，可以注册到broker，并注册服务以及接口，也可以远程调用其他节点的接口
    ffrpc_t ffrpc_service("echo");
    ffrpc_service.reg(&protobuf_service_t::echo, &foo);

    if (ffrpc_service.open(arg_helper))
    {
        return -1;
    }
```
 

跟使用ffmsg_t的方式几乎是一样的，ffreq_t 的msg字段是输入的消息。

调用echo服务器的client的示例代码
 

```cpp
struct protobuf_client_t
{
    //! 远程调用接口，可以指定回调函数（也可以留空），同样使用ffreq_t指定输入消息类型，并且可以使用lambda绑定参数
    void echo_callback(ffreq_t<pb_echo_out_t>& req_, int index, ffrpc_t* ffrpc_client)
    {
        if (req_.error())
        {
            LOGERROR(("XX", "error_msg <%s>", req_.error_msg()));
            return;
        }
        else if (index < 10)
        {
            pb_echo_in_t in;
            in.set_data("Ohnice");
            LOGINFO(("XX", "%s data=%s index=%d callback...", __FUNCTION__, req_.msg.data(), index));
            sleep(1);
            ffrpc_client->call("echo", in, ffrpc_ops_t::gen_callback(&protobuf_client_t::echo_callback, this, ++index, ffrpc_client));
        }
        else
        {
            LOGINFO(("XX", "%s %d callback end", __FUNCTION__, index));
        }
    }
};

    ffrpc_t ffrpc_client;
    if (ffrpc_client.open(arg_helper))
    {
        return -1;
    }
    
    protobuf_client_t client;
    pb_echo_in_t in;
    in.set_data("Ohnice");

　　ffrpc_client.call("echo", in, ffrpc_ops_t::gen_callback(&protobuf_client_t::echo_callback, &client, 1, &ffrpc_client));
```
 

### Protobuf的优点是:
-  支持版本，这样增加字段变得更加容易
-  Protobuf是支持多语言的，这样可以跟其他的语言也可以通讯
### Thrift协议的示例
Thrift 定义文件:
```
namespace cpp ff  

struct echo_thrift_in_t {      
  1: string data
}

struct echo_thrift_out_t {      
  1: string data
}
```
 

### Thrift 的服务器实现代码:
 

```cpp
struct thrift_service_t
{
    //! echo接口，返回请求的发送的消息ffreq_t可以提供两个模板参数，第一个表示输入的消息（请求者发送的）
    //! 第二个模板参数表示该接口要返回的结果消息类型
    void echo(ffreq_thrift_t<echo_thrift_in_t, echo_thrift_out_t>& req_)
    {
        LOGINFO(("XX", "foo_t::echo: recv data=%s", req_.msg.data));
        echo_thrift_out_t out;
        out.data = "123456";
        req_.response(out);
    }
};
thrift_service_t foo;
    //! broker客户端，可以注册到broker，并注册服务以及接口，也可以远程调用其他节点的接口
    ffrpc_t ffrpc_service("echo");
    ffrpc_service.reg(&thrift_service_t::echo, &foo);

    if (ffrpc_service.open(arg_helper))
    {
        return -1;
    }
    
    ffrpc_t ffrpc_client;
    if (ffrpc_client.open(arg_helper))
    {
        return -1;
}
```
 

#### 调用 echo的client的示例:
 

```cpp
struct thrift_client_t
{
    //! 远程调用接口，可以指定回调函数（也可以留空），同样使用ffreq_t指定输入消息类型，并且可以使用lambda绑定参数
    void echo_callback(ffreq_thrift_t<echo_thrift_out_t>& req_, int index, ffrpc_t* ffrpc_client)
    {
        if (req_.error())
        {
            LOGERROR(("XX", "error_msg <%s>", req_.error_msg()));
            return;
        }
        else if (index < 10)
        {
            echo_thrift_in_t in;
            in.data = "Ohnice";
            LOGINFO(("XX", "%s data=%s index=%d callback...", __FUNCTION__, req_.msg.data, index));
            sleep(1);
            ffrpc_client->call("echo", in, ffrpc_ops_t::gen_callback(&thrift_client_t::echo_callback, this, ++index, ffrpc_client));
        }
        else
        {
            LOGINFO(("XX", "%s %d callback end", __FUNCTION__, index));
        }
    }
};
ffrpc_t ffrpc_client;
    if (ffrpc_client.open(arg_helper))
    {
        return -1;
    }
    
    thrift_client_t client;
    echo_thrift_in_t in;
    in.data = "Ohnice";

ffrpc_client.call("echo", in, ffrpc_ops_t::gen_callback(&thrift_client_t::echo_callback, &client, 1, &ffrpc_client));
```
 

### Thrift的优缺点:
*  Thrift 更加灵活，支持list和map，而且可以嵌套
*  支持N种语言
*  官方的版本需要依赖boost，ffrpc从中提取出一个最基本的c++版本，只有头文件，不依赖boost
## 总结
*  Ffrpc是基于c++的网络通讯库，基于broker模式scalability和 易用性是最大的优点
*  使用ffrpc进行进程间通讯非常的容易，定义服务和接口就行了，你除了使用ffmsg_t最传统的消息定义，也可以使用google protobuf和facebook thrift。
*  Ffrpc是全异步的，通过回调函数+lambda方式可以很容易操作异步逻辑。
*  Ffrpc 接下来会有更多的示例，当系统复杂时，ffrpc的优势将会更加明显。
*  Github的地址:https://github.com/fanchy/FFRPC