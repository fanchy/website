---
layout: post
title:  C++ 多进程并发框架FFLIB之Tutorial
categories: fflib
tagline: C++ 多进程并发框架FFLIB之Tutorial
tags:
    - fflib
    - c++
    - socket
excerpt: >
    封装了epoll和socket
---

FFLIB框架是为简化分布式/多进程并发而生的。它起始于本人尝试解决工作中经常遇到的问题如消息定义、异步、多线程、单元测试、性能优化等。基本介绍可以看这里：
http://www.cnblogs.com/zhiranok/archive/2012/07/30/fflib_framework.html

其中之所以特意采用了Broker模式，是吸收了MPI和Erlang的思想。

关于MPI：http://www.mcs.anl.gov/research/projects/mpi/
关于Erlang：http://www.erlang.org/
FFLIB 目前处于alpha阶段，一些有用的功能还需继续添加。但是FFLIB一开始就是为了解决实际问题而生。Broker 即可以以独立进程运行，也可以集成到某个特定的进程中启动。除了这些，FFLIB中使用epoll实现的网络层也极具参考价值。网上有一些关于epoll ET 和 LT的讨论，关于哪种方式更简单，本人的答案是ET。ET模式下epoll 就是一个完全状态机。开发者只需实现FD的read、write、error 三种状态即可。
我进一步挖掘FFLIB的功能。写一篇FFLIB的Tutorial。创建更多的FFLIB使用示例，以此来深入探讨FFLIB的意义。在游戏开发中，或者一些分布式的环境中，有许多大家熟悉的模式。，本文挑选了如下作为FFLIB示例：

### Request/Reply
* 点对点通讯
* 阻塞通讯
* 多播通讯
* Map/Reduce
* Request/Reply
* 异步的Request/Reply

在FFLIB中所有的消息都是Request和Reply一一对应的，默认情况下工作在异步模式。假设如下场景，Flash连入GatewayServer并发送Login消息包，GatewaServer 解析用户名密码，调用LoginServer 验证。

### 首先定义msg:

```cpp
struct user_login_t
{
    struct in_t: public msg_i
    {
        in_t():
            msg_i("user_login_t::in_t")
        {}
        string encode()
        {
            return (init_encoder() << uid << value).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> uid >> value;
        }
        long   uid;
        string value;
    };

    struct out_t: public msg_i
    {
        out_t():
            msg_i("user_login_t::out_t")
        {}
        string encode()
        {
            return (init_encoder() << value).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> value;
        }
        bool value;
    };
};
```cpp
### LoginServer中如此定义接口：

```cpp
class login_server_t
{
public:
    void verify(user_login_t::in_t& in_msg_, rpc_callcack_t<user_login_t::out_t>& cb_)
    {
        user_login_t::out_t out;
        out.value = true;
        cb_(out);
    }
};

login_server_t login_server;
singleton_t<msg_bus_t>::instance().create_service("login_server", 1)
            .bind_service(&login_server)
            .reg(&login_server_t::verify);
```
### 在GatewayServer中调用上面接口：

```cpp
struct lambda_t
    {
        static void callback(user_login_t::out_t& msg_, socket_ptr_t socket_)
        {
            if (true == msg_.value)
            {
                //! socket_->send_msg("login ok");
            }
            else
            {
                //! socket_->send_msg("login failed");
            }
        }
    };

    user_login_t::in_t in;
    in.uid  = 520;
    in.value = "ILoveYou";
    socket_ptr_t flash_socket = NULL;//! TODO

    singleton_t<msg_bus_t>::instance()
         .get_service_group("login_server_t")
        ->get_service(1)
       ->async_call(in, binder_t::callback(&lambda_t::callback, flash_socket));
```
如上所示， async_call 可以通过binder_t模板函数为回调函绑定参数。

### 同步的Request/Reply
　　大部分时候我们期望Reply被异步处理，但有时Reply 必须被首先处理后才能触发后续操作，一般这种情况发生在程序初始化之时。假设如下场景，SceneServer启动时必须从SuperServer中获取配置，然后才能执行加载场景数据等后续初始化操作。

　　首先定义通信的msg：

```cpp
struct config_t
{
    struct in_t: public msg_i
    {
        in_t():
            msg_i("config_t::in_t")
        {}
        string encode()
        {
            return (init_encoder() << server_type << server_id).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> server_type >> server_id;
        }
        int server_type;
        int server_id;
    };
    struct out_t: public msg_i
    {
        out_t():
            msg_i("config_t::out_t")
        {}
        string encode()
        {
            return (init_encoder() << value).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> value;
        }
        map<string, string> value;
    };
};
```
 

### 如上所示， msg 序列化自动支持map。
SuperServer 中定义返回配置的接口：
```cpp
super_server_t super_server;
singleton_t<msg_bus_t>::instance().create_service("super_server", 1)
    .bind_service(&super_server)
    .reg(&super_server_t::get_config);
```
SceneServer 可以如此实现同步Request/Reply:

```cpp
rpc_future_t<config_t::out_t> rpc_future;

config_t::in_t in;
in.server_type = 1;
in.server_id   = 1;

const config_t::out_t& out = rpc_future.call(
        singleton_t<msg_bus_t>::instance().get_service_group("super_server")
        ->get_service(1), in);

cout << out.value.size() <<"\n";
//std::foreach(out.value.begin(), out.value.end(), fuctor_xx);
```
### 点对点通讯
异步Request/Reply 已经能够解决大部分问题了，但是有时处理Push模式时稍显吃了。我们知道消息推算有Push 和Poll两种方式。了解二者：
http://blog.sina.com.cn/s/blog_6617106b0100hrm1.html
上面提到的Request/Reply 非常适合poll模式，以上一个获取配置为例，SuperServer由于定义接口的时候只需知道callback，并不知道SceneServer的具体连接。，所以SuperServer不能向SceneServer Push消息。在FFLIB中并没有限定某个节点必须是Client或只能是Service，实际上可以兼有二者的角色。SceneServer 也可以提供接口供SuperServer调用，这就符合了Push的语义。假设如下场景，GatewayServer需要在用户登入时调用通知SessionServer，而某一时刻SessionServer也可能呢通知GatewayServer 强制某用户下线。二者互为client和service。大家必须知道，在FFLIB中实现两个节点的通信只需知道对方的服务名称即可，Broker 在此时实现解耦的作用非常明显，若要增加对其他节点的通信，只需通过服务名称async_call即可。

#### 定义通信的msg：

```cpp
struct user_online_t
{
    struct in_t: public msg_i
    {
        in_t():
            msg_i("user_online_t::in_t")
        {}
        string encode()
        {
            return (init_encoder() << uid).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> uid;
        }
        long uid;
    };
    struct out_t: public msg_i
    {
        out_t():
            msg_i("user_online_t::out_t")
        {}
        string encode()
        {
            return (init_encoder() << value).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> value;
        }
        bool value;
    };
};

struct force_user_offline_t
{
    struct in_t: public msg_i
    {
        in_t():
            msg_i("force_user_offline_t::in_t")
        {}
        string encode()
        {
            return (init_encoder() << uid).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> uid;
        }

        long uid;
    };

    struct out_t: public msg_i
    {
        out_t():
            msg_i("force_user_offline_t::out_t")
        {}

        string encode()
        {
            return (init_encoder() << value).get_buff();
        }

        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> value;
        }

        bool value;
    };
};
```
GatewayServer 通知SessionServer 用户上线，并提供强制用户下线的接口：

```cpp
class gateway_server_t
{
public:
    void force_user_offline(force_user_offline_t::in_t& in_msg_, rpc_callcack_t<force_user_offline_t::out_t>& cb_)
    {
        //! close user socket
        force_user_offline_t::out_t out;
        out.value = true;
        cb_(out);
    }
};

gateway_server_t gateway_server;

singleton_t<msg_bus_t>::instance().create_service("gateway_server", 1)
            .bind_service(&gateway_server)
            .reg(&gateway_server_t::force_user_offline);

user_online_t::in_t in;
in.uid = 520;

singleton_t<msg_bus_t>::instance()
    .get_service_group("session_server")
    ->get_service(1)
    ->async_call(in, callback_TODO);
```
SessionServer 提供用户上线接口，可能会调用GatewayServer 的接口强制用户下线。

```cpp
class session_server_t
{
public:
    void user_login(user_online_t::in_t& in_msg_, rpc_callcack_t<user_online_t::out_t>& cb_)
    {
        //! close user socket
        user_online_t::out_t out;
        out.value = true;
        cb_(out);
    }
};

session_server_t session_server;

singleton_t<msg_bus_t>::instance().create_service("session_server", 1)
            .bind_service(&session_server)
            .reg(&session_server_t::user_login);

force_user_offline_t::in_t in;
in.uid = 520;

singleton_t<msg_bus_t>::instance()
    .get_service_group("gateway_server")
    ->get_service(1)
    ->async_call(in, callback_TODO);
```
### 多播通信
*  和点对点通信一样，要实现多播，只需要知道目标的服务名称。特别提一点的是，FFLIB中有服务组的概念。比如启动了多个场景服务器SceneServer，除了数据不同，二者接口完全相同，有可能只是相同进程的不同实例。在FFLIB框架中把这些服务归为一个服务组，然后再为每个实例分配索引id。
*  假设如下场景，SuperServer 中要实现一个GM接口，通知所有SceneServer 重新加载配置。
*  定义通信的msg：

```cpp
struct reload_config_t
{
    struct in_t: public msg_i
    {
        in_t():
            msg_i("reload_config_t::in_t")
        {}
        string encode()
        {
            return (init_encoder()).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_);
        }
    };

    struct out_t: public msg_i
    {
        out_t():
            msg_i("reload_config_t::out_t")
        {}

        string encode()
        {
            return (init_encoder() << value).get_buff();
        }

        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> value;
        }

        bool value;
    };
};
```
SceneServer 提供重新载入配置接口：

```cpp
class scene_server_t
{
public:
    void reload_config(reload_config_t::in_t& in_msg_, rpc_callcack_t<reload_config_t::out_t>& cb_)
    {
        //! close user socket
        reload_config_t::out_t out;
        out.value = true;
        cb_(out);
    }
};

scene_server_t scene_server;

singleton_t<msg_bus_t>::instance().create_service("scene_server", 1)
            .bind_service(&scene_server)
            .reg(&scene_server_t::reload_config); 
```
在SuperServer 中如此实现多播（跟准确是广播，大同小异）：

```cpp
struct lambda_t
{
　　static void reload_config(rpc_service_t* rs_)
　　{
          reload_config_t::in_t in;
          rs_->async_call(in, callback_TODO);
　　}
};

singleton_t<msg_bus_t>::instance()
    .get_service_group("scene_server")
    ->foreach(&lambda_t::reload_config);
```
## Map/Reduce
在游戏中使用Map/reduce 的情形并不多见，本人找到网上最常见的Map/reduce 实例 WordCount。情形如下：有一些文本字符串，统计每个字符出现的次数。

*  Map操作，将文本分为多个子文本，分发给多个Worker 进程进行统计
*  Reduce 操作，将多组worker 进程计算的结果汇总
*  Worker：为文本统计各个字符出现的次数
### 定义通信消息： 
```cpp
struct word_count_t
{
    struct in_t: public msg_i
    {
        in_t():
            msg_i("word_count_t::in_t")
        {}
        string encode()
        {
            return (init_encoder() << str).get_buff();
        }
        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> str;
        }
        string str;
    };

    struct out_t: public msg_i
    {
        out_t():
            msg_i("word_count_t::out_t")
        {}

        string encode()
        {
            return (init_encoder() << value).get_buff();
        }

        void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> value;
        }

        map<char, int> value;
    };
};
```
### 定义woker的接口：

```cpp
class worker_t
{
public:
    void word_count(word_count_t::in_t& in_msg_, rpc_callcack_t<word_count_t::out_t>& cb_)
    {
        //! close user socket
        word_count_t::out_t out;
        for (size_t i = 0; i < in_msg_.str.size(); ++i)
        {
            map<int, int>::iterator it = out.value.find(in_msg_.str[i]);
            if (it != out.value.end())
            {
                it->second += 1;
            }
            else
            {
                out.value[in_msg_.str[i]] = 1;
            }
        }
        cb_(out);
    }
};

worker_t worker;

    for (int i = 0; i < 5; ++i)
    {
         singleton_t<msg_bus_t>::instance().create_service("worker", 1)
            .bind_service(&worker)
            .reg(&worker_t::word_count);
    }
```
### 模拟Map/reduce 操作：

```cpp
    struct lambda_t
    {
        static void reduce(word_count_t::out_t& msg_, map<int, int>* result_, size_t* size_)
        {
            for (map<int, int>::iterator it = msg_.value.begin(); it != msg_.value.end(); ++it)
            {
                map<int, int>::iterator it2 = result_->find(it->first);

                if (it2 != result_->end())
                {
                    it2->second += it->second;
                }
                else
                {
                    (*result_)[it->first] = it->second;
                }
            }

            if (-- size_ == 0)
            {
                //reduce end!!!!!!!!!!!!!!!!
                delete result_;
                delete size_;
            }
        }

        static void do_map(const char** p, size_t size_)
        {
            map<int, int>* result  = new map<int, int>();
            size_t*    dest_size   = new size_t();
            *dest_size = size_;

            for (size_t i = 0; i < size_; ++i)
            {
                word_count_t::in_t in;
                in.str = p[i];

                singleton_t<msg_bus_t>::instance()
                    .get_service_group("worker")
                    ->get_service(1 + i % singleton_t<msg_bus_t>::instance().get_service_group("worker")->size())
                    ->async_call(in, binder_t::callback(&lambda_t::reduce, result, dest_size));
            }
        }
    };

    const char* str_vec[] = {"oh nice", "oh fuck", "oh no", "oh dear", "oh wonderful", "oh bingo"};
    lambda_t::do_map(str_vec, 6);
```
 

## 总结：

*  FFLIB 使进程间通信更容易
*  source code:  https://ffown.googlecode.com/svn/trunk
*  示例代码目录：example/tutorial
