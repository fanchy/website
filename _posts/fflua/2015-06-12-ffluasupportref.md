---
layout: post
title:  fflua更新-增加对引用的支持
categories: fflua
tagline: c++接口注册到lua中时，对引用的支持。这样使用起来更加方便。
tags:
    - fflib
    - c++
    - fflua
    - lua
    - 服务器lua
excerpt: >
    c++接口注册到lua中时，对引用的支持。这样使用起来更加方便。
---

### 简介：
fflua 发布了有段时间了，很多网友都用了，并且提供了一些很好的反馈。其中一个就是c++接口注册到lua中时，对引用的支持。这样使用起来更加方便。

#### 原有方式：
fflua 中注册c++的类用如下方式：

```cpp
class base_t
{
public:
    base_t():v(789){}
    void dump()
    {
        printf("in %s a:%d\n", __FUNCTION__, v);
    }
    int v;
};
//! 注册基类函数, ctor() 为构造函数的类型
    fflua_register_t<base_t, ctor()>(ls, "base_t")  //! 注册构造函数
                    .def(&base_t::dump, "dump")     //! 注册基类的函数
                    .def(&base_t::v, "v");          //! 注册基类的属性
```
当c++类注册成功，后lua代码中可以操作类对象的指针，并且可以作为参数传递给c++的接口：
```cpp
void dumy_base(base_t* p)
{
    printf("in %s begin ------------\n", __FUNCTION__);
}
fflua_register_t<>(ls).def(&dumy, "dumy");  //! 注册静态函数
```

有网友跟我反映，原来的接口很多都是使用引用作为参数，为了接收lua传过来的参数，还得需要重新写一个函数，比较麻烦，于是fflua增加了对引用的支持：

```cpp
void dumy_base(base_t& p)
{
    printf("in %s begin ------------\n", __FUNCTION__);
}
fflua_register_t<>(ls).def(&dumy, "dumy"); //! 注册静态函数
```

### 总结：
最新代码：
https://github.com/fanchy/fflua

更多精彩文章 http://h2cloud.org