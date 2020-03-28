---
layout: post
title:  C++ FFLIB之FFRPC：多线程&多进程的scalability探索
categories: fflib
tagline: FFLIB网络框架单线程0.0.1版本-epoll_socket
tags:
    - fflib
    - c++
    - rpc
excerpt: >
    如何更好的使用多线程，或者说使用多线程应该遵循什么样的原则才能避免麻烦。
    如果线程的资源不足以满足要求，那么如何利用多进程的资源但却不至于大范围的修改系统实现。
---

## 摘要：

近来在完成通用的数据分析系统ffcount时，使用了ffrpc完成了事件源和service的通信。顺便对ffrpc进行了优化和精简，接口也更易用一些。
在跟一个朋友讨论多线程和多进程的问题时，引发了如何才能是系统更加scalability的思考。

把自己的一些想法用ffrpc写了一个demo。无论是使用多线程还是多进程，并发都是为了使系统在吞吐量或响应延迟等特性上达到更佳的效果。
那么什么样的设计能够尽量保证scalability呢？

#### 如何更好的使用多线程，或者说使用多线程应该遵循什么样的原则才能避免麻烦。
如果线程的资源不足以满足要求，那么如何利用多进程的资源但却不至于大范围的修改系统实现。
#### 关于多线程&多进程：

对应服务器开发人员来说，多线程编程是最重要的开发技术之一，但是随着实际开发中接触的多线程场景越多，反而越来越尽量少的使用多线程。
多线程往往是看起来甜美，用起来苦涩。许多人过度的注意到了多线程的优点，而极大的忽视了其缺点。下面是一些多线程的技巧：

*  尽量不要使用多线程，如果有明确数据显示单线程无法达到要求，再考虑行之。
*  如果使用了多线程，多线程之间不要共享数据，哪怕是一点点。多线程之间的通讯使用任务队列或者消息队列之类的完成。
*  一般而言普通的cpu计算不需要多线程，若有io操作，并且业务可以并行，可以考虑使用异步加回调的方式使用多线程。
*  使用多线程，切勿因为多线程而多线程，如果业务是不可并行切分的，那么强行拆分则会得不偿失，甚至系统的正确和稳定都难以确保，更不要说后续的扩展和维护。
*  使用多进程可以避免以上的尴尬问题，多进程本身数据不共享，通讯只能使用消息通讯，这些硬性限制反而确保了多进程更加理想。但问题是管理多个进程往往让人不够情愿，尤其是只是用一台机器的时候。能不能有权衡二者的scalability方案？

### FFRPC实现scalability：

在设计ffrpc的时候，首先其适合类似于网游多进程架构的场景。幸运的是，ffrpc封装的是节点与节点之间的通讯，并不限制节点是否在同一个进程。
这样在单进程内使用ffrpc开启多个服务实例，从而利用多线程。若实例开启在多个进程中，则又适配多进程环境。其demo设计为如下系统：


client 请求logic_service，调用其test接口，根据uid的不同，调用不同的logic_service实例，从而实现logic_service并发。
```cpp
test_msg_t::in_t in;
in.uid = i;
test_msg_t::out_t out;
ffrpc.call("logic_service", 1 + in.uid % ffrpc.service_num("logic_service"), in, out);
```

logic_service的test接口被调用后，调用db_service接口，根据uid’不同调用的db_service实例也不同，从而实现db_service的并发。
```cpp
struct lambda_t
{
    static void async_callback(update_msg_t::out_t& msg_)
    {
        sleep(2);
        printf("logic_service_t 接收db_service的返回值 ret_bool=[%d]\n", msg_.value);
    }
};
update_msg_t::in_t in;
in.uid = in_msg_.uid;
ffrpc->async_call("db_service", 1 + in_msg_.uid % ffrpc->service_num("db_service"), in, &lambda_t::async_callback);
```
 

db_service的update被调用后，回调对应的logic_service的回调函数返回结果。
```cpp
int update(update_msg_t::in_t& in_msg_, rpc_callcack_t<update_msg_t::out_t>& cb_)
    {
        sleep(2);
        printf("in db_service_t::update[index=%d], 被logic_service调用uid[%ld]\n", m_index, in_msg_.uid);
        update_msg_t::out_t out;
        out.value = true;
        cb_(out);
        return 0;
    }
```

### 示例源码:

```cpp
#include <stdio.h>

#include "count/ffcount.h"
#include "rpc/broker_application.h"
#include "base/daemon_tool.h"
#include "base/arg_helper.h"
#include "base/strtool.h"

using namespace ff;
bool g_run = false;

struct test_msg_t
{
    struct in_t: public ffmsg_t<test_msg_t::in_t>
    {
        virtual string encode()
        {
            return (init_encoder() << uid).get_buff() ;
        }
        virtual void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> uid;
        }
        long    uid;
    };
    typedef ffmsg_bool_t out_t;
};
struct update_msg_t
{
    struct in_t: public ffmsg_t<update_msg_t::in_t>
    {
        virtual string encode()
        {
            return (init_encoder() << uid).get_buff() ;
        }
        virtual void decode(const string& src_buff_)
        {
            init_decoder(src_buff_) >> uid;
        }
        long    uid;
    };
    typedef ffmsg_bool_t out_t;
};

class logic_service_t
{
public:
    logic_service_t(ffrpc_t* p, int i):ffrpc(p), m_index(i){}
    int test(test_msg_t::in_t& in_msg_, rpc_callcack_t<test_msg_t::out_t>& cb_)
    {
        sleep(2);
        printf("in logic_service_t::test[index=%d], 被client调用 uid[%ld]\n", m_index, in_msg_.uid);

        test_msg_t::out_t out;
        out.value = true;
        cb_(out);
        
        struct lambda_t
        {
            static void async_callback(update_msg_t::out_t& msg_)
            {
                sleep(2);
                printf("logic_service_t 接收db_service的返回值 ret_bool=[%d]\n", msg_.value);
            }
        };
        update_msg_t::in_t in;
        in.uid = in_msg_.uid;
        ffrpc->async_call("db_service", 1 + in_msg_.uid % ffrpc->service_num("db_service"), in, &lambda_t::async_callback);
        return 0;
    }
    
    ffrpc_t* ffrpc;
    int      m_index;
};

class db_service_t
{
public:
    db_service_t(ffrpc_t* p, int i):ffrpc(p), m_index(i){}
    int update(update_msg_t::in_t& in_msg_, rpc_callcack_t<update_msg_t::out_t>& cb_)
    {
        sleep(2);
        printf("in db_service_t::update[index=%d], 被logic_service调用uid[%ld]\n", m_index, in_msg_.uid);
        update_msg_t::out_t out;
        out.value = true;
        cb_(out);
        return 0;
    }
    
    ffrpc_t* ffrpc;
    int      m_index;
};

int start_logic_service(ffrpc_t& ffrpc, logic_service_t& service, arg_helper_t* arg_helper_, int index_)
{
    //printf("start_logic_service index[%d] begin\n", index_);
    assert(0 == ffrpc.open(arg_helper_->get_option_value("-l")) && "can't connnect to broker");

    ffrpc.create_service("logic_service", index_)
            .bind_service(&service)
            .reg(&logic_service_t::test);
    //printf("start_logic_service index[%d] end\n", index_);
    return 0;
}
int start_db_service(ffrpc_t& ffrpc, db_service_t& service, arg_helper_t* arg_helper_, int index_)
{
    //printf("start_db_service index[%d] begin\n", index_);
    assert(0 == ffrpc.open(arg_helper_->get_option_value("-l")) && "can't connnect to broker");

    ffrpc.create_service("db_service", index_)
            .bind_service(&service)
            .reg(&db_service_t::update);
    //printf("start_db_service index[%d] end\n", index_);
    return 0;
}
int main(int argc, char* argv[])
{
    if (argc == 1)
    {
        printf("usage: app -broker -client -l tcp://127.0.0.1:10241 -service db_service@1-4,logic_service@1-4\n");
        return 1;
    }
    arg_helper_t arg_helper(argc, argv);
    if (arg_helper.is_enable_option("-broker"))
    {
        broker_application_t::run(argc, argv);
    }

    if (arg_helper.is_enable_option("-d"))
    {
        daemon_tool_t::daemon();
    }
    
    vector<string> all_service_name;
    strtool_t::split(arg_helper.get_option_value("-service"), all_service_name, ",");
    
    vector<ffrpc_t*>            vt_rpc;
    vector<db_service_t*>       vt_db_service;
    vector<logic_service_t*>    vt_logic_service;
    for (size_t i = 0; i < all_service_name.size(); ++i)
    {
        vector<string> opts;
        strtool_t::split(all_service_name[i], opts, "@");
        int index_begin = 0;
        int index_end   = 0;
        if (opts.size() > 1)
        {
            vector<string> vt_index;
            strtool_t::split(opts[1], vt_index, "-");
            if (vt_index.empty() == false)
            {
                index_begin = ::atoi(vt_index[0].c_str());
                if (vt_index.size() > 1)
                {
                    index_end = ::atoi(vt_index[1].c_str());
                }
            }
        }
        if (index_end < index_begin) index_end = index_begin;
        printf("service includes<%s:%d-%d>\n", opts[0].c_str(), index_begin, index_end);
        
        for (int i = index_begin; i <= index_end; ++i)
        {
            ffrpc_t* ffrpc = new ffrpc_t();
            vt_rpc.push_back(ffrpc);
            if (opts[0] == "db_service")
            {
                db_service_t* service = new db_service_t(ffrpc, i);
                start_db_service(*ffrpc, *service, &arg_helper, i);
                vt_db_service.push_back(service);
            }
            else if (opts[0] == "logic_service")
            {
                logic_service_t* service = new logic_service_t(ffrpc, i);
                start_logic_service(*ffrpc, *service, &arg_helper, i);
                vt_logic_service.push_back(service);
            }
        }
    }
    
    if (arg_helper.is_enable_option("-client"))
    {
        ffrpc_t ffrpc;
        for (int i = 1; i < 100000; ++i)
        {
            sleep(1);
            printf("client 准备调用logic_service[index=%d]\n", i);

            assert(0 == ffrpc.open(arg_helper.get_option_value("-l")) && "can't connnect to broker");

            test_msg_t::in_t in;
            in.uid = i;

            test_msg_t::out_t out;
            ffrpc.call("logic_service", 1 + in.uid % ffrpc.service_num("logic_service"), in, out);
            sleep(8);
            printf("logic_service[index=%d] 调用返回=%d\n", i, out.value);
        }
        ffrpc.close();
    }
    signal_helper_t::wait();
    for (size_t i = 0; i < vt_rpc.size(); ++i)
    {
        vt_rpc[i]->close();
        delete vt_rpc[i];
    }
    for (size_t i = 0; i < vt_db_service.size(); ++i)
    {
        delete vt_db_service[i];
    }
    for (size_t i = 0; i < vt_logic_service.size(); ++i)
    {
        delete vt_logic_service[i];
    }
    return 0;
}
```
运行命令:
```bash
git clone https://github.com/fanchy/fflib
cd  cd fflib/example/book/rpc/
make
```
#运行4个db_service实例和4个logic_service实例
```bash
./app_rpc -client -broker -l tcp://127.0.0.1:10241 -service db_service@1-4,logic_service@1-4
```
 

## 总结：

本例中logic_service和db_service集成到了一个程序中，使用ffrpc可以通过多线程实现并发，各个服务使用异步回调和消息通信，通过配置实例的个数，从而实现多线程的scalability。如果要把服务分别部署到其他机器上，只需启动多个app进程，例如:

启动4个logic_service实例：
```bash
./app_rpc -broker -l tcp://127.0.0.1:10241 -service logic_service@1-4
```
启动4个db_service实例：
```bash
./app_rpc  -l tcp://127.0.0.1:10241 -service db_service@1-4 -client
```
