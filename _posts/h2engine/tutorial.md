# H2Engine服务器氢引擎tutorial #
* * *

- [多协议：支 持WebSocket / Socket](./protocol.html)。
- [多语言支持：C++、python、lua、js、php，c++引擎加脚本处理逻辑，符合当下潮流](./scriptintro.html)。
- [数据库:集成了对Mysql和Sqlite的支持，提供同步异步以及连接池的封装](./databaseintro.html)。
- [分布式：基于ffrpc的分布式调用设计，异步rpc](./ffrpcintro.html)。
- [多进程数据共享：h2engine封装了非常方便的进程数据共享机制，解决例如行会、排名等全局数据难处理的特点](./sharedintro.html)。
- [非侵入是扩展：h2engine提供了非常方便的扩展机制，包括注册c++函数给脚本，增加新模块，增加client新消息处理函数等](./extintro.html)。
***

## 构建
H2Engine目前只有Linux版本，使用cmake，确保系统安装了cmake
> ```cpp
$ cmake  
```

H2Engine进程分另个，h2engine 和h2worker ,其中h2worker根据使用语言的不同，分h2workerpy、h2workerlua、h2workerjs、h2workerphp,根据你使用的语言构建你需要的h2worker即可。
> ```cpp
$make h2engine 
$make h2workerpy 
$make h2workerlua
$make h2workerjs
$make h2workerphp
```

## 依赖说明：
- cmake:构建的时候需要
- python2.6或python2.7:构建h2workerpy的时候需要
- lua5:构建h2workerlua的时候需要
- js v8:构建h2workerjs的时候需要
- libphp5:构建h2workerphp的时候需要,注意需要下载php源码编译出来允许嵌入的版本，./configure --enable-embed  --prefix=~/php5dir - --with-iconv=/usr/local/libiconv
## 运行

> ```cpp
$ ./h2engine -d
$ ./h2workerpy
$ ./h2workerlua
$ ./h2workerjs
$ ./h2workerphp
```

h2engine是核心，需要首先启动，woker进程根据你需要的语言，启动你需要的版本即可。


## 初始化与退出 ##
H2Engine把程序的框架都打好了，一般情况下，开发者不需要再修改main函数了，如果想在程序初始化的时候执行自己特有的一些
初始化操作，H2Engine提供一套非侵入式的初始化和退出的扩展接口。
    比如PlayerService是处理角色上线下线相关的协议消息的，需要再程序启动的时候，注册那些cmd协议需要交由此类处理，
那么再player_service.cpp中直接注册初始化函数，而不需要再去修改main.cpp中加入初始化代码.
> ```cpp
void PlayerService::handleLogin(userid_t sessionId, const std::string& data){
    logic code
}
#define LOGIN_CMD  1
static bool initEnvir(){
    FFWORKER_SINGLETON.regSessionReq(LOGIN_CMD, &PlayerService::handleLogin, &(PlayerServiceSingleton));
    return true;
}
WORKER_AT_SETUP(initEnvir);//!对应的WORKER_AT_EXIT(exitEnvir)处理退出时操作
```

* * *
## 注册脚本函数 ##
> ```cpp
static userid_t Entity_getUid(EntityPtr p){
    if (p){
        return p->getUid();
    }
    return 0;
}
static size_t Entity_totalNum(){
    return Entity::EntityPtr2Ref.size();
}
static bool initEntityEnvir(){
    //!这里演示的是如何注册脚本接口
    SCRIPT_UTIL.reg("Entity.getUid", Entity_getUid);
    SCRIPT_UTIL.reg("Entity.totalNum", Entity_totalNum);
    printf("initEntityEnvir....\n");
    return true;
}
WORKER_AT_SETUP(initEntityEnvir);
```

注册之后，无论你选择哪种脚本语言，都可以调用此函数，以Python为例，ffext.callFunc('Entity.totalNum')就可以调用Entity_totalNum这个
函数，H2Engine 的SCRIPT工具类对python，lua，js，php都做了适配，一次编写，人人可用。这个的初衷是，假如有人写了很好的c++封装类比如
成就系统，那么虽然你用的Python我用的lua，但是你的类库我也可以拿来即用。

* * *
## 事件机制 ##
> ```cpp
//db_service.cpp 处理对象增删改查相关的操作
static void handleCreateEntityEvent(CreateEntityEvent& e){
    printf("handleEvent %d %s\n", e.eventID(), e.eventName().c_str());
}
static void handleUpdateEntityEvent(UpdateEntityEvent& e){
    printf("handleUpdateEntityEvent %d %s\n", e.eventID(), e.eventName().c_str());
}
static void handleDelEntityEvent(DelEntityEvent& e){
    printf("handleDelEntityEvent %d %s\n", e.eventID(), e.eventName().c_str());
}
bool DbService::init(){
    EVENT_BUS_LISTEN(&handleCreateEntityEvent);
    EVENT_BUS_LISTEN(&handleUpdateEntityEvent);
    EVENT_BUS_LISTEN(&handleDelEntityEvent);
    return true;
}
static bool initEnvir(){
    return DbServiceSingleton.init();
}
WORKER_AT_SETUP(initEnvir);
```

H2Engine中封装了一个EventBus事件总线的机制，当产生事件的时候，丢到EventBus，监听此事件的函数会自动被调用，使用了观察者模式，
这样可以实现非侵入式的扩展功能，这也是H2Engine最大的设计特点。发布事件如下所示：
> ```cpp
handleCreateEntityEvent e(entity);
EVENT_BUS_FIRE(e);
```

* * *
## 定时器 ##
> ```cpp
void callback(arg1, arg2....)//!最多支持9个参数
{
}
int mstimeout_ = 1000;
FFWORKER_SINGLETON.regTimer(mstimeout_,  TaskBinder::gen(&lambda_cb::callback, arg1, arg2....));
```
