##  H2Engine 下载
The project is [hosted](https://github.com/fanchy/h2engine) on GitHub: [https://github.com/fanchy/h2engine](https://github.com/fanchy/h2engine)

##  H2Engine 介绍
[http://h2cloud.org/intro.html](http://h2cloud.org/intro.html)

## Features
- [多协议：支 持WebSocket / Socket](./protocol.html)。
- [多语言支持：C++、python、lua、js、php，c++引擎加脚本处理逻辑，符合当下潮流](./scriptintro.html)。
- [数据库:集成了对Mysql和Sqlite的支持，提供同步异步以及连接池的封装](./databaseintro.html)。
- [分布式：基于ffrpc的分布式调用设计，异步rpc](./ffrpc.html)。
- [多进程数据共享：h2engine封装了非常方便的进程数据共享机制，解决例如行会、排名等全局数据难处理的特点](./sharedmem.html)。
- [非侵入是扩展：h2engine提供了非常方便的扩展机制，包括注册c++函数给脚本，增加新模块，增加client新消息处理函数等](./extintro.html)。