---
layout: post
title:  利用LUA协程实现FUTURE模式
categories: fflua
tagline: 利用LUA协程实现FUTURE模式
tags:
    - lua
    - 协程
excerpt: >
    利用LUA协程实现FUTURE模式
---

## Future模式：
参见http://www.cnblogs.com/zhiranok/archive/2011/03/26/Future_Pattern.html
使用future的好处是即利用了异步的并行能力，又保证主逻辑串行执行，保持简单。

### Lua 协程
sina Timyang 的介绍 http://timyang.net/lua/lua-coroutine/
lua coroutine 通过create创建一个伪线程，该“线程”通过yield可以挂起自己，通过调用resume可以使该“线程”从挂起位置继续执行。

### LUA coroutine 实现 Future
假设有如下应用场景：

*  用户登录系统，需要将用户数据从Mysql中获取用户数据，然后在LUA中实例化user_t对象。
*  用户登录事件由C++触发，将uid参数传递给lua
*  lua 并不存在mysql接口，必须委托c++完成mysql操作，而且lua state必须被单线程操作，顾我们期望LUA不能被阻塞，在单个user从mysql 载入数据
　　时其他user应该能够继续接受请求

故我们设计了如下解决方案：

* lua中的user_t对象每个实例拥有两个主要数据，
　　*  request_cache，在user未初始化完成时该uid的请求将被缓存起来（我们将请求封装成function）。
    *  coroutine ，该协程尝试将request_cache中的所有请求执行完毕，当出现如下情况该协程为挂起自己
　　　　-  request_cache 为空，挂起等待新的请求
　　　　-  需要执行mysql时挂起，等待mysql执行完毕被唤醒。

示例代码：
```lua
user_t = {}
user_t.__index = user_t

function user_t:new()
    local funjc = function() print("TODO exe all request in request_cache") end
    local ret =
    {
        ["request_cache"] = {},
        ["coroutine_obj"] = coroutine.create(funjc),
    }
    setmetatable(ret, self)
    return ret
end
```

 

* C++ 封装异步调用Mysql的接口，注册接口到LUA
* future_t 用于LUA和C++传递数据

```cpp
class future_t
{
public:
　　 void   set_result(const string& v_) { m_result = v_;   }
    string get_result() const           { return m_result; }
private:
    string m_result;
};
```

### async_load_data_from_db 用于异步执行mysql操作

```cpp
void async_load_data_from_db(future_t* ret_)
{
    //! post another thread, async exe load data from db
    thread.post(boost::bind(do_load_data_from_db, ret_));    
}

void do_load_data_from_db(future_t* ret_)
{
    //! TODO exe sql opertion
    lua_pcall("resume_routine")
}
```
 

lua 调用C++的接口async_load_data_from_db，async_load_data_from_db 将请求post另外的线程，执行mysql请求，将请求结果赋值到future中，调用lua的resume函数唤醒
lua协程继续执行
###  LUA 示例代码
```lua
user_t = {}
user_t.__index = user_t

function user_t:new(uid_)
    local ret =
    {
        ["uid"]              = uid_,
        ["request_cache"] = {},
        ["coroutine_obj"] = true,
        ["runing_flag"]      = true,
    }
    setmetatable(ret, self)

    local func = function()
        while true == runing_flag
            if 0 == #ret.request_cache
            then
                coroutine.yield()
            else
                local todo_func = ret.request_cache[1]
                local tmp = {}
                for k = 2, #ret.request_cache
                do
                    table.insert(tmp, ret.request_cache[k])
                end
                ret.request_cache = tmp
                todo_func()
            end
        end
    end
    ret.coroutine_obj = coroutine.create(func)
    return ret
end

function user_t:init()
    local func = function()
        local future = future_t:new()
        async_load_data_from_db(future)
        coroutine.yield()
        print("user_t:init ok", self.uid, future:get_result())
        future:delete()
    end
    table.insert(self.request_cache, func)
    coroutine.resume(self.coroutine_obj)
end

function user_t:resume_routine()
    coroutine.resume(self.coroutine_obj)
end

local test_user = user_t:new(1122334)

function user_login()
    return test_user:init()
end

function resume_routine()
    return test_user:resume_routine()
end
```

### 注意事项：
尽管一个lua state是串行执行的，使用lua coroutine时仍然要注意数据一致性，比如在coroutine执行时使用了全局变量，yield挂起后全局变量有可能被修改了，
所以协程适合于例子中的user_t对象，各个user是互不干扰的，相同的user请求会被单个协程串行化。