# H2Engine服务器引擎文档:C++#
* * *
## 处理客户端请求 ##
> ```cpp
virtual int when_session_req(userid_t session_id_, uint16_t cmd_, const std::string& data_);
```

## 处理client 下线 ##
> ```cpp
virtual int when_session_offline(userid_t session_id);
```

## 处理client 切换worker ##
> ```cpp
virtual int when_session_enter(userid_t session_id, const std::string& extra_data);
``` 

## 发送消息给特定的client ##
> ```cpp
int session_send_msg(const std::string& gate_name, const userid_t& session_id_, uint16_t cmd_, const std::string& data_);
```

## 多播 ##
> ```cpp
int session_multicast_msg(const std::vector<userid_t>& session_id_, uint16_t cmd_, const std::string& data_);
```

## 广播整个Gate的client ##
> ```cpp
int gate_broadcast_msg(uint16_t cmd_, const std::string& data_);
```

## 强制关闭客户端 ##
> ```cpp
int session_close(const userid_t& session_id_);
```

## client跳转到指定worker ##
> ```cpp
int session_change_worker(const userid_t& session_id_, int to_worker_index_, std::string extra_data = "");
```

## 定时器 ##
> ```cpp
void reg_timer(uint64_t mstimeout_, task_t func);
```

## 获取client的ip ##
> ```cpp
const std::string& get_session_ip(const userid_t& session_id_);
```

## 异步查询数据库 ##
> ```cpp
void async_query(long db_id_,const string& sql_, function_t callback);
```

## 同步查询数据库 ##
> ```cpp
result query(long db_id_,const string& sql_);
```

## 调用其他worker的接口 ##
> ```cpp
void worker_rpc(int workerindex, int16_t cmd, const string& argdata, function_t callback)
```

## 被其他worker调用 ##
> ```cpp
virtual std::string when_worker_call(uint16_t cmd, const std::string& body);
```

##  异步 http请求 ##
> ```cpp
bool async_http(const string& url_, int timeoutsec, function_t callback);
```

##  同步 http请求 ##
> ```cpp
string sync_http(const string& url_, int timeoutsec, function_t callback);
```
