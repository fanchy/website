---
layout: post
title:  linux下IPC latency 进程间通讯延迟测试结果
categories: tech
tagline: linux下IPC latency 进程间通讯延迟测试结果
tags:
    - linux
    - c++
    - ipc
excerpt: >
    linux下选择一个IPC，主要倾向于unix socket，ipc-bench测试下来感觉更有底了，10K数据传输9us的延时在大多数应用中都可以接受了
---
#### 测试环境
```
CPU name : Intel(R) Xeon(R) CPU E5405 @ 2.00GHz
processor : 4
cpu MHz : 1995.021
```

#### IPC latency:
```
IPC TYPE: 　　MessageSize: 　　Average Latency:
unix socket 　　10K 　　　　　　9us
localhost tcp 　 10K 　　　　　　11us
pipe 　　　　　  10K 　　　　　　6us
remote TCP 　　10K 　　　　　　13us

IPC throughput:
IPC TYPE: 　　MessageSize: 　　Average throughput/msg: 　　Average throughput/M:
unix socket 　　10K 　　　　　　183049 msg/s 　　　　　　　　14643 Mb/s
localhost tcp 　 10K 　　　　　　113901 msg/s 　　　　　　　　9112 Mb/s
pipe 　　　　　  10K 　　　　　  146724 msg/s 　　　　　　　　 11737 Mb/s

```
#### 测试代码：
http://github.com/rigtorp/ipc-bench

想在linux下选择一个IPC，主要倾向于unix socket，ipc-bench测试下来
感觉更有底了，10K数据传输9us的延时在大多数应用中都可以接受了，
这样某些应用可以使用类似于Nginx的多进程模式，网络层一个进程，
逻辑层多进程，而且可以跑脚本，既能利用同步编写逻辑，又可发挥多核优势
