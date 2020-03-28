---
layout: post
title:  LUA面向对象编程技巧
categories: fflua
tagline: LUA面向对象编程技巧
tags:
    - lua
    - fflua
    - lua对象
excerpt: >
    我们知道，对象由属性和方法组成。LUA中最基本的结构是table，So 必须用table描述对象的属性。lua中的function可以用来表示方法。
    那么LUA中的类可以通过table + function模拟出来。至于继承，可以通过metetable模拟出来（不推荐用，只模拟最基本的对象大部分时间够用了）。
---

## LUA中的对象

我们知道，对象由属性和方法组成。LUA中最基本的结构是table，So 必须用table描述对象的属性。lua中的function可以用来表示方法。那么LUA中的类
可以通过table + function模拟出来。至于继承，可以通过metetable模拟出来（不推荐用，只模拟最基本的对象大部分时间够用了）。

## Metatable
Lua中的metatable 类似于C++中的虚函数，当索引table中的项不存在时，会进一步索引metetable（如果设置了的话）是否存在该项。这跟虚函数概念
不是很吻合么？

## 示例class
```lua
user_t = {}
user_t.__index = user_t
```
以上代码声明class user_t。为了方便，user_t声明为全局的table。__index 是跟设置metatable有关，
详细信息参见lua manual http://www.lua.org/manual/5.1/

实际上__index 应该赋值为function，这里是一个语法糖，等价于

user_t.__index = function(key) return user_t[key] end 
定义构造函数：

```lua
function user_t:new(uid_)
    local obj = 
    {
        ["uid"] = uid_,
    }
    setmetatable(obj, self)
    return obj
end
function user_t:dump()
 print("self:", self.uid)
end
```

定义一个user_t对象代码如下：
```lua
local user = user_t:new(1122334)
user:dump()
```
new 函数返回一个table, 当索引dump时，obj中没有dump函数，尝试去metatable中索引，获得dump函数。

注意：
```lua
function user_t.dump(self) ：方式定义函数只是个语法糖而已，其等价于
function user_t.dump(self)
    print("self:", self.uid)
end
```
通常我都会对应定义一个析构函数（不好意思C++流）
```lua
function user_t:delete()
    self.uid = nil
end
```
4. 实现继承
原理就是利用metatable，__index 设置这样的function，当前类不存在某项时，尝试去基类中查出

```lua
person_t = {}
person_t.__index = person_t

function person_t:new()
    local obj = 
    {
        ["type"] = "person",
    }
    setmetable(person_t, self)
    return obj
end

function person_t:type()
    print("type:", self["type"])
end

function user_t:new(uid_)
    local obj = 
    {
        ["uid"] = uid_,
    }
    local mt = 
    {
        ["__index"] = function(key_)
            local ret = user_t[key_] or person_t[key_]
            return ret
        end
    }
    setmetatable(obj, mt)
    return obj
end
local user = user_t:new(1122334)
user:type()
```

## 注意
* 尽量不要使用多重继承
* 不要尝试使用重载

更多精彩文章 http://h2cloud.org
