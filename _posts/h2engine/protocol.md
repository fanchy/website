# H2Engine 协议设计 
　　H2Engine服务器引擎通讯协议支持websocket和tcp scoket ，而数据协议是可以用任何格式，这里需要说明通讯协议和数据协议的区别，通讯协议举个例子，浏览器和服务器通讯使用的http协议，这里http就是通讯协议，浏览器调用服务器的接口，可以用json、xml、text等，这里就是数据协议。

## Websocket
　　标准的websocket协议实现，h2engine提供一个调试用html websocket客户端，可以做简单的调试演示用。需要说明的是，开发者在使用websocket与H2Engine通讯时，发送数据的格式为cmd:协议号\n数据。这里的协议号必须是数字，这个会最终传给worker，用于区分数据的内容和调用的接口。因为这里用的是字符串，所以不存在大小端的问题。

## socket二进制
　　这个是传统的游戏服务器的通讯协议，4字节len+2字节cmd+2字节reserved+数据,len表示后边数据的长度，cmd是协议号，len，cmd，reserverd三个字段必须用网络字节序。

## 数据协议
　　这里就看开发者的喜好了，简单点就json，性能高点就pb和thrift，本人更推荐thrift，这个对各个语言支持都非常好，数据格式也很紧凑。
> ```cpp
struct TestLogicMsg{
    1:i64    nData
    2:string strData
}
```

　　生成thrift的名利为：thrift --gen <language> <Thrift filename>，在H2Engine中tool目录，提供了win下的thrift程序方便开发者使用。PortocolBuff这个大家都非常熟悉了，就不多说了。