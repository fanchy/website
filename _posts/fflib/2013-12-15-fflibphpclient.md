---
layout: post
title:  ffrpc的php客户端lib
categories: fflib
tagline: ffrpc 是c++异步通讯库，使用ffrpc可以非常容易的构建服务器程序。
tags:
    - fflib
    - rpc
    - php socket
excerpt: >
    ffrpc 是c++异步通讯库，使用ffrpc可以非常容易的构建服务器程序。为了使用方便，ffrpc提供了python、php的客户端lib，这样使用php于c++构建的server也是顺手拈来。ffrpc使用thrift或者protobuf作为通信协议，这样实现各个语言版本的ffrpc客户端lib就很容易。
---

## 摘要：
ffrpc 是c++异步通讯库，使用ffrpc可以非常容易的构建服务器程序。为了使用方便，ffrpc提供了python、php的客户端lib，这样使用php于c++构建的server也是顺手拈来。ffrpc使用thrift或者protobuf作为通信协议，这样实现各个语言版本的ffrpc客户端lib就很容易。

#### 示例：
本例采用php + thrift 和ffrpc构建的echo server 通信，echo server实现的细节可以参见 http://www.cnblogs.com/zhiranok/p/ffrpc_client_server.html

#### thrift的定义文件为：

```
struct echo_thrift_in_t {      
  1: string data
}

struct echo_thrift_out_t {      
  1: string data
}
```
#### 使用ffrpc-php调用echo接口:

```php
function test()
{
    include_once  "ff/Types.php";

    $req   = new ff\echo_thrift_in_t();
    $ret   = new ff\echo_thrift_out_t();
    $req->data = 'OhNice!!!!';
    $ffrpc = new ffrpc_t('127.0.0.1', 10246);
    if ($ffrpc->call('echo', $req, $ret, 'ff'))
    {
        var_dump($ret);
    }
    else{
        echo "error_msg:".$ffrpc->error_msg()."\n";
    }
}
```
## 总结：
*  ffrpc 目前有支持c++、python、server
*  协议支持protocolbuf和thrift
*  Github: https://github.com/fanchy/FFRPC

更多精彩文章 http://h2cloud.org