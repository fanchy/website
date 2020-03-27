# H2Engine 扩展机制 
　　H2Engine的扩展机制主要分两块，一个是注册c++函数给脚本用，这个在[脚本设计](./scriptintro.html)  中已经介绍。还有两种扩展机制也非常有特点。

## 分侵入式增加模块
　　其他市面上的一些服务器引擎都有这样的确定，加入c++功能模块时，难免要不模块include到引擎中去，H2Engine中是不需要这样的，你不需要修改H2Engine中现有的任何代码，但是你新增的模块可以无缝的集成到引擎中。举个例子你开发了一个任务系统，TaskModule，需要启动的时候初始化，比如读取配置，注册定时器等，传统的实现肯定时在main函数的时候，加入TaskModule的init代码，退出的地方加入cleanup的代码，这个就是侵入式设计。在H2Engine中提供了两个宏：WORKER_AT_SETUP，WORKER_AT_EXIT 注册初始化函数和退出函数。
> ```cpp
static bool initTaskModule(){
    //!todo logic code
}
static bool exitTaskModule(){
    //!todo logic code
}
WORKER_AT_SETUP(initTaskModule);
WORKER_AT_EXIT(exitTaskModule);
```

　　不需要在main代码里include你的模块代码，是不是有点黑科技？

## 事件机制
　　H2Engine中封装了一个EventBus事件总线的机制，当产生事件的时候，丢到EventBus，监听此事件的函数会自动被调用，使用了观察者模式， 这样可以实现非侵入式的扩展功能，这也是H2Engine最大的设计特点。发布事件如下所示：
> ```cpp
handleCreateEntityEvent e(entity);
EVENT_BUS_FIRE(e);
```

　　这种设计的好处是，当有人开发了一个功能模块，抛出可能开发者感兴趣的事件，保留了外部扩展的能力而不需要回过头来修改已有功能的代码。
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
