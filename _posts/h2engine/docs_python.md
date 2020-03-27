# H2Engine服务器引擎文档:Python#
* * *
## 处理客户端请求 ##
> ```python
def  when_session_req(session_id_, cmd_, data_);
```

## 处理client 下线 ##
> ```python
def  when_session_offline(session_id);
```

## 处理client 切换worker ##
> ```python
def  when_session_enter(session_id, extra_data);
``` 

## 发送消息给特定的client ##
> ```python
def session_send_msg(session_id_, cmd_, data_);
```

## 多播 ##
> ```python
def session_multicast_msg(session_ids, cmd_, data_);
```

## 广播整个Gate的client ##
> ```python
def gate_broadcast_msg(cmd_, data_);
```

## 强制关闭客户端 ##
> ```python
def session_close(session_id_);
```

## client跳转到指定worker ##
> ```python
def session_change_worker(session_id_, to_worker_, extra_data);
```

## 定时器 ##
> ```python
def reg_timer(mstimeout_, func);
```

## 获取client的ip ##
> ```python
get_session_ip(session_id_);
```

## 连接数据库 ##
> ```python
db_id connect_db(host);
```

## 异步查询数据库 ##
> ```python
def async_query(db_id_,sql_, callback);
```

## 同步查询数据库 ##
> ```python
result query(db_id_,sql_);
```

## 调用其他worker的接口 ##
> ```python
def worker_rpc(workerindex, cmd, argdata, callback)
```

## 被其他worker调用 ##
> ```python
def when_worker_call(cmd, body);
```

##  异步 http请求 ##
> ```python
def async_http(url_, timeoutsec, callback);
```

##  同步 http请求 ##
> ```python
string sync_http(url_, timeoutsec, callback);
```
