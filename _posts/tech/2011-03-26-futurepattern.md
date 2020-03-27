---
layout: post
title:  FuturePattern
categories: tech
tagline: FuturePattern研究
excerpt: >
    FuturePattern研究
---

## FuturePattern研究

### Started：

俗话说一年之计在于春，一天之计在于晨，当我起床的时候，看见表正指向九点钟，十一点下班，十点上班，这是我现在的工作节奏。来北京马上就一个月了，近二十多天里，每天的天气都非常的妩媚，但是工作原因，只能困在办公室里，真是太遗憾了。
看到MSDN的这篇文章【http://msdn.microsoft.com/zh-cn/library/dd764564.aspx#Y300】好像是今年2月份，快过年的样子。记得还特蛋疼的研究了一下lamada的汇编实现。当时看到Visual Studio 2010 实现的lamada非常的飘逸，对于future并没有太在意。贴一段飘逸的代码：

```cpp
async_future<int> max_value([&]() -> int {

      int largest = INT_MIN;

      for_each(values.begin(), values.end(), [&](int value) {

         if (value > largest)

         {

            largest = value;

         }

      });

      return largest;

   });
```

最近翻看PoSA4时，又研究了一下future模式，对future有了新的理解。

### What：

    什么是future：future的原理是当你申请资源（计算资源或I/O资源）时，
    立即返回一个虚拟的资源句柄，当真正使用的时候，
    再将虚拟的句柄转化成真正的资源，相当于预获取。

### How：
         Future使用方法伪代码如下:
```cpp
         Future::Future(Job_func):

                   Thread.run(Job_func);

         end

         Future::get_result():

                   While(result == NULL):

                            Thread.sleep()

                   Return result

         End
```

### Why:

    Future模式只有在并行运算的框架内才有意义。当一个逻辑操作设计的耗时操作比较多时，
    可以将耗时操作拆分成多个不太耗时的子操作，使子操作并行的执行，逻辑层依次获取子操作的结果。
    架设我们要执行一个逻辑操作，要求执行一次mysql查询，还要读一次文件，如果使用普通的同步方式：

```cpp
Do:

query = Mysql_query()

file = File_read()

         Do_thing(query, file)

Done
```

使用future模式示例如下：

```cpp
Do：

         Future a(Mysql_query)//! 非阻塞

         Future b(File_read) //! 非阻塞

         Query = a.get_result() //! 阻塞获取结果

         File = b.get_result()　//! 阻塞获取结果

         Do_thing(query, file)

Done
```

这样sql查询和读取文件实现了并行运行，同步等待的时间为二者开销较大的运行时间。

### When：

    适于使用future模式的时机：在客户端，我们常常需要阻塞的获取结果，通过future模式可以大大提高响应速度。
    而在服务端程序，阻塞操作会降低系统的吞吐量，future模式试用的范围较窄，一般服务端采用异步回调的方式，
    将耗时的操作并行化，再通过回调方式将结果合并。Future构造时生成了虚拟的结果，如果使用这个结果越晚，
    当get_result时越不容易阻塞，所以从生成future到获取结果的间隔越长，future模式的功效越大。
    
    