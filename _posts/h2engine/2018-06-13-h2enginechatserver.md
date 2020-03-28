---
layout: post
title:  游戏服务器设计之聊天室示例
categories: h2engine
tagline: 针对前面使用boost asio 中遇到的问题，对asio进行封装
tags:
    - 游戏服务器
    - 聊天室
    - socket
excerpt: >
    h2engine引擎建群以后，有热心网友向我反馈，想尝试h2engine但是没有服务器开发经验觉得无从入手，希望我能提供一个简单明了的示例。
    由于前一段时间工作实在忙碌，一直没有抽出时间好好写一下，后来抽空写了出来，
    自己从小白开发者的角度重新审视了一遍h2engine,自己也收获匪浅，也优化了部分h2engine的架构，使其更易使用。
    以前的例子都是c++加脚本的例子，这次写一个纯c++的例子。
---
# 游戏服务器设计之聊天室示例
## 简介
h2engine引擎建群以后，有热心网友向我反馈，想尝试h2engine但是没有服务器开发经验觉得无从入手，希望我能提供一个简单明了的示例。

由于前一段时间工作实在忙碌，一直没有抽出时间好好写一下，后来抽空写了出来，自己从小白开发者的角度重新审视了一遍h2engine,自己也收获匪浅，
也优化了部分h2engine的架构，使其更易使用。以前的例子都是c++加脚本的例子，这次写一个纯c++的例子。

#### 开发服务器程序一般有如下几个基本操作：
1. 启动程序，监听网络端口，初始化相应的模块
2. 注册消息处理函数,根据不同的协议号，不同的逻辑处理，并把相应的结果返回给客户端。
3. 数据的增删改查，设计到数据库的连接池、异步查询等技术。
4. 定时器，除了用户触发的接口，就剩定时器触发接口了
写一个基本的服务器架子，无非就上面几个东西，h2engine就是要简化我们搭建服务器的成本，拿来即用,下面以聊天室为例，分别阐述之。

## 启动程序以及初始化服务
h2engine是一个服务器引擎，封装了启动操作，简单说就是main已经提前写好了，也不推荐你改，比如日志初始化，后台服务处理啊balabala这些玩意都帮忙处理好了，你无非是想自己定义的模块程序启动的时候能够加载进去，是吧？h2engine的src目录是放用户自定义模块的地方，比如自己创建很多目录比如item处理道具模块，chat处理聊天模块，等等。src的目录下有一个setup.cpp这个就相当于main.cpp,用户初始化的代码放到这里就可以了，下面截取一个setup.cpp的示例。

```cpp
#include "server/ffworker.h"
#include "server/entity.h"
#include "player/player.h"
#include "map/map.h"
#include "task/task.h"
#include "chat/chat.h"
using namespace ff;
using namespace std;
static bool initEnvir(){
    PlayerModule::init();
    MapModule::init();
    TaskModule::init();
    ChatModule::init();
    return true;
}
WORKER_AT_SETUP(initEnvir);
static bool cleanupEnvir(){
    return true;
}
WORKER_AT_EXIT(cleanupEnvir);
```
其实，setup.cpp这个文件名是没有任何要求的，随便你取什么名字，setup.cpp比较见名知意。如上所示，启动的时候我们启动了PlayerModule MapModule TaskModule ChatModule。根据你的需求增加初始化代码，cleanupEnvir是处理服务器关闭的事件回调，你可以在这里添加相应的处理代码。
问题来了，网络监听在哪里设置，网络监听没啥搞头，已经做了标准化，配置一下gate_listen参数就可以改变监听的端口号，默认监听44000。

## 消息处理
一般都是使用整数协议号 + 数据的方式处理消息，协议号用枚举定义，数据格式可以json，protobuff，thrift都可以。本示例只是简单演示，直接使用的字符串。

```cpp
enum ChatCmdDef{
    CHAT_C_LOGIN       = 101, //!演示用，随意定义
    CHAT_C_BROADCAST   = 102,
    CHAT_S_BROADCAST   = 102
};
bool ChatModule::init(){
    CMD_MGR.setCmdHookFunc(cmdValidCheckFunctor);
    CMD_MGR.reg(CHAT_C_LOGIN,            &handleLogin);
    CMD_MGR.reg(LOGOUT_CMD,              &handleLogout);
    CMD_MGR.reg(CHAT_C_BROADCAST,        &handleChat);
    //!一般而言，初始化的时候需要创建表，读取配置等
    string sql = "create table IF NOT EXISTS chattest (UID integer, CHAT_TIMES interger);";
    DB_MGR.query(sql);
    return true;
}
```
如上示例了一个典型模块的初始化，这里很好的演示了怎么模块化而不是把所有消息都注册到一个大文件里。以聊天室的需求为例，这里处理三个请求，登陆请求，登出请求，和聊天请求。
1. 登陆请求，一般流程是查询数据库，验证账号密码，载入用户数据, 将用户数据发给客户端，也同步给其他在线的用户。

```cpp
struct ChatLoginDbFunctor{
    void operator()(QueryDBResult& result){
        if (entity->getSession() == 0){
            //!异步载入数据的过程中，user可能下线
            return;
        }
        char buff[256] = {0};
        if (result.dataResult.empty()){//! 数据库里没有数据，创建一条数据
            snprintf(buff, sizeof(buff), "insert into chattest (UID, CHAT_TIMES) values ('%lu', '0')", uid);
            DB_MGR.asyncQueryModId(uid, buff);
        }
        else{
            entity->get<ChatCtrl>()->nChatTimes = ::atoi(result.dataResult[0][0].c_str());
        }
        EntityPtr old = ENTITY_MGR.get(ENTITY_PLAYER, uid);
        if (old){//!重登录，踢掉原来的
            old->sessionClose();
            ENTITY_MGR.del(ENTITY_PLAYER, uid);
        }
        entity->setUid(uid);
        entity->setType(ENTITY_PLAYER);
        ENTITY_MGR.add(entity);


        snprintf(buff, sizeof(buff), "user[%lu]进入了聊天室！", entity->getUid());
        FFWORKER.gateBroadcastMsg(CHAT_S_BROADCAST, buff);//!这个是gate广播也就是全服广播
    }
    userid_t    uid;
    EntityPtr   entity;
};
static void handleLogin(EntityPtr entity, const string& msg){//!处理登录，简单示例，用字符串协议
    userid_t uid = ::atoi(msg.c_str());
    if (uid == 0){
        entity->sendMsg(CHAT_S_BROADCAST, "非法操作，请先使用101协议登录，参数为uid(非0)！");
        return;
    }
    char sql[256] = {0};
    snprintf(sql, sizeof(sql), "select CHAT_TIMES from chattest where UID = '%lu'", uid);
    ChatLoginDbFunctor dbFunc;
    dbFunc.uid = uid;
    dbFunc.entity = entity;
    DB_MGR.asyncQueryModId(uid, sql, dbFunc);

}
```
如上所示，这个登陆函数虽小，但是还算写的蛮规矩的，如果已经登陆过了，忽略，重登陆了踢掉老的。而且数据载入是异步，非常具有生产环境的参考价值。
2. 登出请求，一般是关闭客户端，保存用户数据，删除一些连接状态，同步给其他在线的客户端。

```cpp
static void handleLogout(EntityPtr entity, const string& msg){
    //!清除缓存
    if (entity->getUid() == 0){
        return;
    }
    char buff[256] = {0};
    snprintf(buff, sizeof(buff), "update chattest set CHAT_TIMES = '%d' where UID = '%lu'",
                                 entity->get<ChatCtrl>()->nChatTimes, entity->getUid());
    DB_MGR.asyncQueryModId(entity->getUid(), buff);

    snprintf(buff, sizeof(buff), "user[%lu]离开了聊天室！", entity->getUid());
    FFWORKER.gateBroadcastMsg(CHAT_S_BROADCAST, buff);//!这个是gate广播也就是全服广播
    ENTITY_MGR.del(ENTITY_PLAYER, entity->getUid());
}
```
如上代码所示，下线清缓存，保存数据，广播其他玩家。
3. 聊天请求，本示例简单起见，广播给所有人。

```cpp
struct ChatFunctor{
    bool operator()(EntityPtr e){
        e->sendMsg(CHAT_S_BROADCAST, destData);
        return true;
    }
    string destData;
};
static void handleChat(EntityPtr entity, const string& msg){
    //!简单示例，广播给所有人
    char buff[256] = {0};
    entity->get<ChatCtrl>()->nChatTimes += 1;
    snprintf(buff, sizeof(buff), "user[%lu]说:%s 发言总次数[%d]", entity->getUid(), msg.c_str(), entity->get<ChatCtrl>()->nChatTimes);
    ChatFunctor func;
    func.destData = buff;
    ENTITY_MGR.foreach(ENTITY_PLAYER, func);//!这里遍历每一个entity，也就是本worker上的所有用户,这个是示例，不如gateBroadcastMsg效率高
}
```
上面代码示例了如何做广播操作，发给客户端无非就是单播和广播，这里都有示例，entity是一个非常重要的概念，可以让你非常方便迅速的开始你的业务而不用建立各种乱七八糟的缓存。

## 数据的增删改查
DB_MGR封装了关系型数据库的操作，支持sqlite和mysql，本示例使用了sqlite，保证你编译完项目就可以立即体验而不用过分操心怎么搭建mysqlserver。二者切换只是配置的不同而已。代码不用任何修改。DB_MGR分同步接口和异步接口，异步接口在服务器编程中用的非常常见，一般用一个仿函数作为回调函数。DB_MGR.asyncQueryModId使用了连接池，不同的uid会分配在不同的连接上，确保数据库操作更加高效，又保证单个用户的数据库操作是有序的。
## 定时器
定时器比较简单，这个聊天示例貌似也用不到，暂时没有加上需要的可以自己查看一下FFWORKER.regTimer(mstimeout_, callback);
## 总结
1. 模块初始化，非侵入式设计，非常容易的集成自己的模块
2. 注册网络消息的处理函数，CMD_MGR注册一下
3. 异步数据库查询，包括查询后的回调，使用DB_MGR进行相关操作。
4. 定时器，异步定时器，回调的时候也保证是在主线程。
5. 模拟客户端 [http://h2cloud.org/client.html](http://h2cloud.org/client.html)
6. GitHub地址:  [https://github.com/fanchy/h2engine](https://github.com/fanchy/h2engine)
7. 关于游戏服务器引擎h2engine：[http://www.cnblogs.com/zhiranok/p/ffengine.html](http://www.cnblogs.com/zhiranok/p/ffengine.html)

更多精彩文章 [http://h2cloud.org/](http://h2cloud.org/)