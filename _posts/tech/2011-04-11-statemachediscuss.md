---
layout: post
title:  状态机的实现探讨
categories: tech
tags:
    - C++
    - ai
    - statemachine
tagline: 实现一个状态机很容易，但是实现一个好的状态机却不简单。
excerpt: >
    状态机的实现探讨
---

## 状态机的实现探讨

### Started：

实现一个状态机很容易，但是实现一个好的状态机却不简单。一般实现状态机的时候会有如下的实现代码：
     
```cpp
switch (state_)
 case A:
    do_A();
 case B:
    do_B();
end switch
```
   当状态量少并且各个状态之间变化的逻辑比较简单时，这种方法无可厚非，但是它有如下缺点：

*  逻辑代码较混乱；如状态A到状态B的切换，如果需要验证有效性，那么代码会变得臃肿，不再那么直观；示例：

```cpp
case A:
 if (current_state != C)
    return -1;
 else
   current_state = A;
   return 0;
case 
```

*  难扩展；大部分状态的处理是相似的，而某些特殊的状态则要特殊处理，比如需要提供附加数据，
比如在Task中设定一个状态为suspend，那么需要传递一个要挂起的时间。这种情况类似于GUI程序中的事件通知接口，如：

```cpp
handle_event(EventId event_, Long ext,...)
```

ext实际上可以传递任何东西。比如触发了一个文件拖动到图标的事件dropOpen，那么可以将要open的文件路径的地址通过ext传入。
这种方式挺万金油的，所以在实现状态机的时候，完全可以借鉴一下。

### Context：
假设场景如下：实现任务Task，它是一个状态机，其状态变化如图：

![](/assets/img/statemachediscuss/statemachediscuss1.jpg)


*  Task被创建后假设获取了必须资源，进入Ready状态
*  Ready状态可以被任务队列执行run， 那么Task进入Running状态
*  Ready状态时可以被suspend挂起，挂起时需要标识挂起的时间
*  Running状态时可以被挂起
*  Suspended状态可以通过润使Task进入running状态
*  Running、Ready、Suspended状态都可以通过cancel，直接进入ended状态

### Question:

*  合理实现各个状态之间的切换
*  方便扩展，任务状态有可能会增加，任务的触发时间可能会改变等，状态机的实现必须能够快速适应逻辑的变化

### Solution：
下面探讨如下的实现方案：

#### 设计基类：

首先是用于传递扩展数据的万金油虚类

```cpp
#ifndef EVENT_DATA_H
#define EVENT_DATA_H

class EventData
{
public:
    virtual ~EventData() {}; 
    void*   data() = 0;
};
#endif //EVENT_DATA_H
```

状态的通用接口类StateMachine 接口, 此类不但定义了接口,其实其规定了状态机实现的模板,任何状态机的实现都可以按照此模板按部就班的实现.

```cpp
#ifndef STATE_MACHINE_H
#define STATE_MACHINE_H

#include <stdio.h>
#include "EventData.h"

struct StateStruct;

// base class for state machines
class StateMachine
{
public:
    StateMachine(int maxStates);
    virtual ~StateMachine() {}

protected:
    enum { EVENT_IGNORED = 0xFE, CANNOT_HAPPEN };
    unsigned char currentState;
    void ExternalEvent(unsigned char, EventData* = NULL);
    void InternalEvent(unsigned char, EventData* = NULL);
    virtual const StateStruct* GetStateMap() = 0;

private:
    const int _maxStates;
    bool _eventGenerated;
    EventData* _pEventData;
    void StateEngine(void);
};

typedef void (StateMachine::*StateFunc)(EventData *);

struct StateStruct
{
    StateFunc pStateFunc;   
};

#define BEGIN_STATE_MAP \
public:\
const StateStruct* GetStateMap() {\
    static const StateStruct StateMap[] = {
#define STATE_MAP_ENTRY(entry)\
    { reinterpret_cast<StateFunc>(entry) },
#define END_STATE_MAP \
    { reinterpret_cast<StateFunc>(NULL) }\
    }; \
    return &StateMap[0]; }

#define BEGIN_TRANSITION_MAP \
    static const unsigned char TRANSITIONS[] = {\
#define TRANSITION_MAP_ENTRY(entry)\
    entry,
#define END_TRANSITION_MAP(data) \
    0 };\
    ExternalEvent(TRANSITIONS[currentState], data);
#endif //STATE_MACHINE_H
```


ExternalEvent接口是带有效性验证的接口,他首先判断状态的有效性,如果有效则调用InternalEvent, InternalEvent是没有验证的内部接口,
它直接的修改状态。

StateMachine 的实现；此实现为通用的逻辑模板，任何状态机的实现都可以套用此模板。

```cpp
#include <assert.h>
#include "StateMachine.h"

StateMachine::StateMachine(int maxStates) :
    _maxStates(maxStates),
    currentState(0),
    _eventGenerated(false),
    _pEventData(NULL)
{
}   
// generates an external event. called once per external event
// to start the state machine executing
void StateMachine::ExternalEvent(unsigned char newState,
                                 EventData* pData)
{
    // if we are supposed to ignore this event
    if (newState == EVENT_IGNORED) {
        // just delete the event data, if any
        if (pData) 
            delete pData;
    }
    else if (newState == CANNOT_HAPPEN) {
        //! throw exception("xxx");
        //! or
        //! logerror("....");
    }
    else {
        // generate the event and execute the state engine
        InternalEvent(newState, pData);
        StateEngine();                 
    }
}

// generates an internal event. called from within a state
// function to transition to a new state
void StateMachine::InternalEvent(unsigned char newState,
                                 EventData* pData)
{
    _pEventData = pData;
    _eventGenerated = true;
    currentState = newState;

}
// the state engine executes the state machine states
void StateMachine::StateEngine(void)
{
    EventData* pDataTemp = NULL;
    if (_eventGenerated) {        
        pDataTemp = _pEventData;  // copy of event data pointer
        _pEventData = NULL;       // event data used up, reset ptr
        _eventGenerated = false;  // event used up, reset flag
        assert(currentState < _maxStates);
        // execute the state passing in event data, if any
        const StateStruct* pStateMap = GetStateMap();
        (this->*pStateMap[currentState].pStateFunc)(pDataTemp);
        // if event data was used, then delete it
        if (pDataTemp) {
            delete pDataTemp;
            pDataTemp = NULL;
        }
    }
}
```

在这里ExternalEvent判断该状态是否是有效的，如果是EVENT_IGNORED，那么可以直接忽略此操作，如果是CANNOT_HAPPEN，说明出现了逻辑错误。

具体task的实现如下：

```cpp
#ifndef TASK_H
#define TASK_H
#include "StateMachine.h"

struct TaskData : public EventData
{
    int xxx;
};

class Task : public StateMachine
{
public:
    Task() : StateMachine(ST_MAX_STATES) {}
    // external events taken by this state machine
    void Suspend();
    void Run();
    void Cancel();
private:
    // state machine state functions
    void ST_Ready();
    void ST_Running();
    void ST_Suspended(TaskData* pData);
    void ST_Ended();
    // state map to define state function order
    BEGIN_STATE_MAP
        STATE_MAP_ENTRY(ST_READY)
        STATE_MAP_ENTRY(ST_RUNNING)
        STATE_MAP_ENTRY(ST_SUSPENDED)
        STATE_MAP_ENTRY(ST_ENDED)
    END_STATE_MAP

    // state enumeration order must match the order of state
    // method entries in the state map
    enum E_States {
        ST_READY = 0,
        ST_RUNNING,
        ST_SUSPENDED,
        ST_ENDED,
        ST_MAX_STATES
    };
};

#endif //MOTOR_H
```

BEGIN_STATE_MAP 宏将自定义的状态函数注册到StateMap中，这样可以直接通过state值索引得到其对应的状态函数。

Task的实现代码

```cpp
#include <assert.h>
#include "task.h"

void Task::Suspend(MotorData* pData)
{
    BEGIN_TRANSITION_MAP                      // - Current State -
        TRANSITION_MAP_ENTRY (ST_Suspended)   // ST_READY
        TRANSITION_MAP_ENTRY (ST_Suspended)   // ST_RUNNING
        TRANSITION_MAP_ENTRY (EVENT_IGNORED)  // ST_SUSPENDED
        TRANSITION_MAP_ENTRY (CANNOT_HAPPEN)  // ST_ENDED
    END_TRANSITION_MAP(pData)
}
void Task::Run(void)
{
    BEGIN_TRANSITION_MAP                      // - Current State -
        TRANSITION_MAP_ENTRY (ST_RUNNING)     // ST_READY
        TRANSITION_MAP_ENTRY (EVENT_IGNORED)  // ST_RUNNING
        TRANSITION_MAP_ENTRY (ST_RUNNING)     // ST_SUSPENDED
        TRANSITION_MAP_ENTRY (CANNOT_HAPPEN)  // ST_ENDED
    END_TRANSITION_MAP(NULL)
}

void Task::Cancel(void)
{
    BEGIN_TRANSITION_MAP                      // - Current State -
        TRANSITION_MAP_ENTRY (ST_ENDED)       // ST_READY
        TRANSITION_MAP_ENTRY (ST_ENDED)       // ST_RUNNING
        TRANSITION_MAP_ENTRY (ST_ENDED)       // ST_SUSPENDED
        TRANSITION_MAP_ENTRY (EVENT_IGNORED)        // ST_ENDED
    END_TRANSITION_MAP(NULL)
}

void Task::ST_Ready()
{
    InternalEvent(ST_READY);
}

void Task::ST_Running()
{
    InternalEvent(ST_RUNNING);

}

void Task::ST_Suspended(MotorData* pData)
{
    InternalEvent(ST_SUSPENDED, pData);
}

void Task::ST_Ended()
{
    InternalEvent(ST_ENDED);
}
```

### 总结

在状态的处理上思路是：状态要么是有效的、要么是可以忽略的、要么是根本不会发生的。

