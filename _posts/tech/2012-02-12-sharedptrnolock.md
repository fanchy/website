---
layout: post
title:  智能指针shared_ptr【无锁设计基于GCC】
categories: tech
tagline: 每个shared_ptr会使对象的引用计数加+1，当引用计数为0时，对象将被析构
tags:
    - sharedptr
    - 智能指针
    - cpp
excerpt: >
    使用过Boost的话对shared_ptr一定有很深的印象。多个shared_ptr指向同一个对象，每个shared_ptr会使对象的引用计数加+1，当引用计数为0时，
    对象将被析构
---
## shared_ptr 介绍
使用过Boost的话对shared_ptr一定有很深的印象。多个shared_ptr指向同一个对象，每个shared_ptr会使对象的引用计数加+1，当引用计数为0时，
对象将被析构。本文实现一个简洁版本的shared_ptr，并没有太多跨平台特性，实现代码可以再GCC上运行。

本文中的引用计数由ref_count_t类实现，参见下文的详细分析。
详文另见：
代码详见：http://ffown.sinaapp.com/?p=49
svn co http://ffown.googlecode.com/svn/trunk/fflib/lib

##  shared_ptr 的构造
我们期望shared_ptr的行为尽量的接近原始指针的行为。所以shared_ptr应该支持三种构造方式

* 空构造类似与void* p =NULL;
* shared_ptr可以通过原始对象指针构造，类似于void* p = q;
* shared_ptr 可以通过已存在的shared_ptr构造。

首先shared_ptr是一个模板类，其由连个属性。
```cpp
private:
    object_t*       m_dest_ptr;
    ref_count_t*    m_ref_count;
};
```

其中m_dest_ptr 指向目标对象, m_ref_count 用来记录该对象的引用计数。为了简单，shared_ptr类遵循一个原则m_dest_ptr和m_ref_count  同时为NULL，或同时不为NULL。

其中 object_t 为模板类型的别名。
```cpp
template<typename T>
class shared_ptr_t
{
public:
    typedef T               object_t;
    typedef shared_ptr_t<T> self_type_t;
```
### 空构造目标对象和引用计数默认都为空。
```cpp
template<typename T>
shared_ptr_t<T>::shared_ptr_t(object_t* p):
    m_dest_ptr(p),
    m_ref_count(NULL)
{
    if (NULL != m_dest_ptr)
    {
        m_ref_count = new ref_count_t();
    }
}

　　share_ptr_t<int> p;
```
### 支持原始对象指针作为构造函数参数

```cpp
template<typename T>
shared_ptr_t<T>::shared_ptr_t(object_t* p):
    m_dest_ptr(p),
    m_ref_count(NULL)
{
    if (NULL != m_dest_ptr)
    {
        m_ref_count = new ref_count_t();
    }
}
```
用例：share_ptr_t<int> p(new int());

### 使用已存在的shared_ptr 构造

```cpp
template<typename T>
shared_ptr_t<T>::shared_ptr_t(self_type_t& p):
    m_dest_ptr(p.get()),
    m_ref_count(p.ger_ref_count())
{
    if (NULL != m_dest_ptr)
    {
        m_ref_count->inc();
    }
}
```
用例： share_ptr_t<int> q(p);

## shared_ptr 获取引用计数或原始指针
有时需要知道shared_ptr当前引用计数的值，通过shared_ptr获取原始指针理所当然。So：
```cpp
size_t       ref_count() const       { return m_ref_count != NULL? (size_t)m_ref_count->size(): 0; }
object_t*    get() const             { return m_dest_ptr; }
```
所以很容易验证shared_ptr的行为：
```cpp
shared_ptr_t p(new int());
assert(p.ref_count() == 1);
shared_ptr_t<int> q(p);
assert(q.ref_count() == 1);
```
## 减少引用计数
shared_ptr需要显示的析构对象，所以提供reset接口，当目标对象已经创建并且引用计数达到零时（即不再有shared_ptr保存目标对象的控制权），析构目标对象。

```cpp
template<typename T>
void shared_ptr_t<T>::reset()
{
    if (m_dest_ptr)
    {
        if (true == m_ref_count->dec_and_check_zero())
        {
            delete m_ref_count;
            delete m_dest_ptr;
        }
        m_ref_count = NULL;
        m_dest_ptr = NULL;
    }
}
```
## shared_ptr 的析构
很简单，减少引用计数。
```cpp
template<typename T>
shared_ptr_t<T>::~shared_ptr_t()
{
    reset();
}
```

## 像原始指针一样使用shared_ptr

可以这样使用shared_ptr
```cpp
struct foo_t { int a; }
shared_ptr_t<foo_t> p(new foo_t());
(*p).a = 100;
p->a = 100;
if(p) cout << "p not null!\n";
```
所以提供如下接口：

```cpp
template<typename T>
typename shared_ptr_t<T>::object_t&    shared_ptr_t<T>::operator*()
{
    assert(NULL != m_dest_ptr);
    return *m_dest_ptr;
}

template<typename T>
typename shared_ptr_t<T>::object_t*    shared_ptr_t<T>::operator->()
{
    assert(NULL != m_dest_ptr);
    return m_dest_ptr;
}
operator bool() const
{
    return NULL != m_dest_ptr;
}

```
### Lock Free引用计数实现
GCC中已经定义了一些atomic operation，但是查阅资料后，应该是对Intel的平台支持较好，其他平台支持不确定。故把atomic操作封装成宏。
```cpp
#define ATOMIC_ADD(src_ptr, v)                         (void)__sync_add_and_fetch(src_ptr, v)
#define ATOMIC_SUB_AND_FETCH(src_ptr, v)  __sync_sub_and_fetch(src_ptr, v)
```
ref_count_t 实现很简单：

```cpp
class ref_count_t
{
    typedef  volatile long atomic_t;
public:
    ref_count_t():
        m_ref_num(1)
    {}
    ~ref_count_t()
    {}

    inline void inc()
    {
        ATOMIC_ADD(&m_ref_num, 1);
    }
    inline bool dec_and_check_zero()
    {
        return 0 == ATOMIC_SUB_AND_FETCH(&m_ref_num, 1);
    }
    inline atomic_t size()
    {
        return m_ref_num;
    }

private:
    atomic_t m_ref_num;
};
#endif
```
### 线程安全性

* 单线程多个shared_ptr指向不同的对象，安全。
* 单线程多个shared_ptr指向相同的对象，安全。
* 多线程多个操作不同的shared_ptr， 指向不同的对象，安全。
* 多线程多个操作不同的shared_ptr， 指向相同对象，shared_ptr安全（也就是引用计数维护正确），对于原始对象操作依赖于用户。
