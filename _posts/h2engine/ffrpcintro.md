# H2Engine 分布式调用ffrpc 
　　ffrpc是H2Engine 网络通信库,全异步 + 回调函数 机制,基于Broker模式设计,

## ffrpc注册服务接口
　　ffrpc注册接口非常容易，当注册的时候实际上就指定了请求的消息和应答的消息类型，属于基于异步的request-response，基于1-req/1-res的模型也更利于理解和测试。
> ```cpp
int FFWorker::processSessionReq(ffreq_t<RouteLogicMsg_t::in_t, RouteLogicMsg_t::out_t>& req_)
{
    RouteLogicMsg_t::out_t out;
    req_.response(out);
    return 0;
}
m_ffrpc = new FFRpc("ffworker#1");
m_ffrpc->reg(&FFWorker::processSessionReq, this);
m_ffrpc->reg(&FFWorker::processSessionOffline, this);
m_ffrpc->reg(&FFWorker::processSessionEnter, this);
m_ffrpc->reg(&FFWorker::processWorkerCall, this);
```

## ffrpc 调用远程接口
　　
> ```cpp
m_ffrpc = new FFRpc("client#1");
ffreq_t<RouteLogicMsg_t::in_t in;
struct echo_client_t
{
    //! 远程调用接口，可以指定回调函数（也可以留空），同样使用ffreq_t指定输入消息类型，并且可以使用lambda绑定参数
    static void echo_callback(ffreq_t<echo_t::out_t>& req_)
    {}
}
m_ffrpc->call("ffworker#1", in, ffrpc_ops_t::gen_callback(&test_client_t::test_callback));
```

## ffrpc 中的broker
　　ffrpc中的worker角色既可以是作为服务提供者，也可以是服务调用者，那么worker之间是如何发现彼此的呢 ？ffrpc中有一个broker的角色，每个worker角色都会注册自己到broker，同时broker同步所有信息给所有人，在H2Engine中h2engine进程是核心，有且只有一个，他就扮演了broker的角色。记住worker永远不会填写对方worker的地址参数，二是通过名字索引到broker中的实例，这就是h2engine的分布式的设计哲学：服务的位置无关性是保证系统scalability的关键。