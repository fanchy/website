---
layout: post
title:  C++ FFLIB之FFXML： 极简化TinyXml 读取
categories: fflib
tagline: 封C++中解析XML已经有一些非常成熟的类库可以使用，TinyXml是最受欢迎的解析类库之一
tags:
    - fflib
    - c++
    - tinyxml
    - c++读取xml
excerpt: >
    封C++中解析XML已经有一些非常成熟的类库可以使用，TinyXml是最受欢迎的解析类库之一。尽管TinyXml已经已经封装了解析细节，
    但是解析、遍历Xml仍然是稍显繁琐。FFXML针对如下需求对TinyXml做了轻量封装
---

## 摘要：

XML是结构化的标记语言，经常被用来做配置文件。由于XML的具有非常强的自描述属性，使用XML的配置文件往往直观易懂。

C++中解析XML已经有一些非常成熟的类库可以使用，TinyXml是最受欢迎的解析类库之一。尽管TinyXml已经已经封装了解析细节，
但是解析、遍历Xml仍然是稍显繁琐。FFXML针对如下需求对TinyXml做了轻量封装：

只把XML当成配置文件，也就是说，只有对XML的读取操作，在我日工作中，都是用XML当做纯配置文件，把XML当成序列化文件或数据文件的情况少之又少。
XML配置文件不会太大，我们假设限制在几千行以内，通常XML配置文件不需要那么大，在这种需求下，的XML的读取效率不是问题，
易用性会被放到首位，必须非常容易获取xml中的内容。

我们知道XML是结构化的，有层级的概念，这对于C++中的内存模型多多少少会有区别，所以往往获取XML内容的代码会有各种循环、判断、嵌套。
FFXML提供了一种“标记语法”使得获取XML内容可以和XML的结构息息对应，即保障了直观，又很容易修改，比如调整了XML的层级关系，
FFXML能够保障大多数情况只需改几个字母，而不是修改嵌套的循环代码.

## 标记语言：

### 实现先给出示例的XML内容

```xml
<game type = "good">
    <scene>happly</scene>
    <role ID="123456"  pos = "any">
        <name nick = "xx" >OhNice</name>
        <num>99</num>
    </role>
</game>
```
我们知道，如果使用tinyXml读取XML，每一层都需要使用特定的接口获取，从而必须要写一写循环和判断甚至嵌套。
FFXML提供了一种“标记语法”来表示XML中各个层级的关系：

*  game.scene ffxml通过 “.”  来分割各个层级，game.scene 代表获取root标记下层的scene标记  在FFXML中获取scen标记的值简单到一行代码const char* scene_val = ffxml.get(“game.scene”);
*  game.{type}  FFXML通过 “{}”表示属性标记，root.{type}表示获取root标记内的type属性的值, 使用FFXML获取type属性的值的代码仍然只有一行:const char* type_val = ffxml.get(“game.{type}”);
*  game.@0  获取game标签下的索引0的标签内容,也就是scene的内容,即const char* scene_val = ffxml.get(“game.@0”);
*  game.&0  获取game标记下索引0的字标记的name，也就是ffxml.get(“game.&0”) == “scene”;
*  game.{@0} 获取game标记下索引0的属性值
*  game.{&0}  获取game标记下索引0的属性的name

FFXML 提供size接口获取字标记的数量如ffxml.size(“game.role”)   表示role标记下字子标记的数量=2
size 接口也可以获取属性的数量，如ffxml.size(“game.role.{}”) 表示role标记属性的个个数

### 示例代码:

```cpp
#include "xml/ffxml.h"
using namespace ff;


int main(int argc, char* argv[])
{
    ffxml_t ffxml;
    
    //! 载入test.xml
    if (ffxml.load("test.xml"))
    {
        printf("test.xml 载入失败\n");
        return 1;
    }

    printf("获取字段     game.scene:        %s\n", ffxml.get("game.scene"));
    printf("获取字段     game.role.name:    %s\n", ffxml.get("game.role.name"));
    printf("获取字段     game.role.num:     %s\n", ffxml.get("game.role.num"));
    
    printf("获取属性     game.{type}:       %s\n", ffxml.get("game.{type}"));
    printf("获取属性     game.role.{ID}:    %s\n", ffxml.get("game.role.{ID}"));
    
    printf("获取标记数量 game:              %u\n", ffxml.size("game"));
    printf("获取标记数量 game.role:         %u\n", ffxml.size("game.role"));
    
    printf("获取属性数量 game:              %u\n", ffxml.size("game.{}"));
    printf("获取属性数量 game.role:         %u\n", ffxml.size("game.role.{}"));
    
    //! 遍历子节点
    char arg_key[128];
    char arg_val[128];
    for (size_t i = 0; i < ffxml.size("game.role"); ++i)
    {
        sprintf(arg_key, "game.role.&%u", i);
        sprintf(arg_val, "game.role.@%u", i);
        printf("遍历子节点   game.role:         %s->%s\n", ffxml.get(arg_key), ffxml.get(arg_val));
    }
    
    //! 遍历属性节点
    for (size_t i = 0; i < ffxml.size("game.role"); ++i)
    {
        sprintf(arg_key, "game.role.{&%u}", i);
        sprintf(arg_val, "game.role.{@%u}", i);
        printf("遍历属性     game.role:         %s->%s\n", ffxml.get(arg_key), ffxml.get(arg_val));
    }
    
    
    printf("组合         game.role.@1.{@nick} %s\n", ffxml.get("game.role.@0.{@nick}"));
    return 0;
}
```
## 总结：
详细源代码：[https://github.com/fanchy](https://github.com/fanchy)
