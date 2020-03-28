---
layout: post
title:  安全编程-c++野指针和内存泄漏
categories: tech
tagline: 安全编程-c++野指针和内存泄漏
tags:
    - c++
    - 野指针
    - 内存泄漏
excerpt: >
    尽管C++ 野指针和内存泄漏一直被诟病，但是在实时性很强的应用场合，c++ 仍然是不二之选。游戏服务器开发仍然使用c++ 作为主语言，但是大多结合动态脚本技术，一方面规避了野指针和内存泄露，一方面获得了开发效率和扩展性的红利。但脚本技术不是本文的讨论重点，事实上关于c++ 与 lua的技术文章我也一直在整理中，将会另文别述。今天主要说说在使用c++过程中，如何避免和解决野指针和内存泄漏问题。
---

## 摘要：
尽管C++ 野指针和内存泄漏一直被诟病，但是在实时性很强的应用场合，c++ 仍然是不二之选。游戏服务器开发仍然使用c++ 作为主语言，但是大多结合动态脚本技术，一方面规避了野指针和内存泄露，一方面获得了开发效率和扩展性的红利。但脚本技术不是本文的讨论重点，事实上关于c++ 与 lua的技术文章我也一直在整理中，将会另文别述。今天主要说说在使用c++过程中，如何避免和解决野指针和内存泄漏问题。

## 野指针：
野指针的出现会导致程序崩溃，这是每个人都不愿意看到的。Linux会生成coredump文件，可用gdb分析。Win下可以注册unexception获取调用堆栈，将错误信息写到文件中。先分析一下通常出现野指针的场景：

```cpp
class monster_t
{
protected:
    player_t* m_attack;

public:
    void handle_ai()
    {
        if (m_attack)
        {
            int x = m_attack->get_x();
        }
    }
}
```

问题就在于，m_attack有值，但是对应的对象已经被销毁了。这是大部分野指针出现原因。分析类之间关系可知，monster_t 和 player_t是0-1的关系，monster_t引用player_t，但是player_t甚至都不知道有一个（或N个）monster 引用了自己。所以当player被销毁时，很难做到把所有引用该player_t的地方全部重置。这种问题其实比较常见，比如player中引用connection，而connection又是被网络层管理生命周期的，也同样容易产生野指针情况。常见的解决方式是：

```cpp
class monster_t
{
protected:
    long m_attack_id;

public:
    void handle_ai()
    {
        player_t* attack = obj_mgr.get(m_attack_id);
        if (attack)
        {
            int x = attack->get_x();
        }
    }
}
```
 

另外一种与之相似的方式：

```cpp
class monster_t
{
protected:
    player_t* m_attack;

public:
    void handle_ai()
    {
        if (obj_mgr.is_exist(m_attack))
        {
            int x = m_attack->get_x();
        }
        else
        {
            m_attack = NULL;
        }
    }
}
```
 
梳理野指针的产生原因后，我们其实需要的是这样的指针：
一种指针，引用了另一个对象的地址（不然就不是指针了），当目标对象销毁时，该指针自然指向null，而不需要目标对象主动通知重置。
幸运的是，这种指针已经有了，就是weak_ptr; 在boost库中，sharedptr,scopedptr,weakptr统称为smartptr。可以尽量使用智能指针，
避免野指针。本人建议尽量使用shared_ptr结合weak_ptr使用。Scoped_ptr本人使用的较少，只是在创建线程对象的时候使用，
正好符合不能复制的语义。使用shared_ptr和weak_ptr的示例代码：

```cpp
class monster_t
{
protected:
    weak_ptr<player_t> m_attack;
    shared_ptr<player_t> get_attack()
    {
        return shared_ptr<player_t>(m_attack);
    }
public:
    void handle_ai()
    {
        shared_ptr<player_t> attack = get_attack();
        if (attack)
        {
            int x = attack->get_x();
        }
    }
}
```
 

有人问monster_t为什么不直接使用shared_ptr，如果使用shared_ptr就不符合现实的模型了，monster_t显然不应该控制player_t的生命周期，

如果使用了shared_ptr，那么可能导致player_t被延迟析构，甚至会导致内存暴涨。这也是shared_ptr的使用误区，
所以本人建议尽量shared_ptr和weak_ptr结合用，否则野指针问题解决了，内存泄漏问题又来了。

### 内存泄漏：
野指针问题可以通过采用良好的编程范式，尽量规避，但总计c++规避内存泄漏的方法却很为难，简单而言尽量保证对象的分配和释放（分别）是单个入口的，这样大部分问题都可以拦截在code review阶段。那么怎么检测内存泄漏呢？

首先说明本方法区别于valgrind等工具，该工具是调试期进行的检测，本文探究的是运行期的检测，确切说是运行期定时输出所有对象的数量到日志中。

首先定义分配、释放对象的接口：

```cpp
template<typename T>
T* new_obj()
{
    T* p = new T();
    singleton_t<obj_counter_t<T> >::instance().inc(1);
    return p;
}

template<typename T, typename ARG1>
T* new_obj(ARG1 arg1)
{
    T* p = new T(arg1);
    singleton_t<obj_counter_t<T> >::instance().inc(1);
    return p;
}

template<typename T, typename ARG1, typename ARG2>
T* new_obj(ARG1 arg1, ARG2 arg2)
{
    T* p = new T(arg1, arg2);
    singleton_t<obj_counter_t<T> >::instance().inc(1);
    return p;
}
template<typename T>
T* new_array(int n)
{
    T* p = new T[n];
    singleton_t<obj_counter_t<T> >::instance().inc(n);
    return p;
}
```
 

为了节省篇幅，这里只列举了三种构造的代码，当分配对象时，对应的类型数量增加1，obj_counter 使用原子操作为每一种类型记录其数量。

```cpp
class obj_counter_i
{
public:
    obj_counter_i():m_ref_count(0){}
    virtual ~ obj_counter_i(){}
    void inc(int n) { (void)__sync_add_and_fetch(&m_ref_count, n); }
    void dec(int n) { __sync_sub_and_fetch(&m_ref_count, n);        }
    long val() const{ return m_ref_count;                            }

    virtual string get_name() { return ""; }
protected:
    volatile long m_ref_count;
};
template<typename T>
class obj_counter_t: public obj_counter_i
{
    obj_counter_t()
    {
        singleton_t<obj_counter_t<T> >::instance().reg(this);
    }
    virtual string get_name() { return TYPE_NAME(T); }
};
```
 

相应的当对象被释放的时候，对应的对象数量减一，示例代码如下：

```cpp
template<typename T>
void del_obj(T* p)
{
    if (p)
    {
        delete p;
        singleton_t<obj_counter_t<T> >::instance().dec(1);
    }
}
```
 

这样就做到了所有的对象的数量都被记录了，可以定时的将对象数量输出到文件：

```cpp
class obj_counter_summary_t
{
public:
    void reg(obj_counter_i* p)
    {
        m_all_counter.push_back(p);
    }

    map<string, long> get_all_obj_num()
    {
        map<string, long> ret;
        for (list<obj_counter_i*>::iterator it = m_all_counter.begin(); it != m_all_counter.end(); ++it)
        {
            ret.insert(make_pair((*it)->get_name(), (*it)->val()));
        }
        return ret;
    }

    void dump(const string& path_)
    {
        ofstream tmp_fstream;
        tmp_fstream.open(path_.c_str());
        map<string, long> ret = get_all_obj_num();
        map<string, long>::iterator it = ret.begin();

        time_t timep   = time(NULL);
        struct tm *tmp = localtime(&timep);

        char tmp_buff[256];
        sprintf(tmp_buff, "%04d%02d%02d-%02d:%02d:%02d",
                tmp->tm_year + 1900, tmp->tm_mon + 1, tmp->tm_mday,
                tmp->tm_hour, tmp->tm_min, tmp->tm_sec);
        char buff[1024] = {0};

        snprintf(buff, sizeof(buff), "obj,num,%s\n", tmp_buff);
        tmp_fstream << buff;

        for (; it != ret.end(); ++it)
        {
            snprintf(buff, sizeof(buff), "%s,%ld\n", it->first.c_str(), it->second);
            tmp_fstream << buff;
        }

        tmp_fstream.flush();
    }
protected:
    list<obj_counter_i*>    m_all_counter;
};
```
 

 

输出的文件格式为csv格式，方便进一步做数据分析。可以使用我开发的小工具格式化csv数据。url:http://ffown.sinaapp.com/perf/csv.html

#### 文件内容data:
```
obj,num,20120606-17:01:41
dumy,1111
foo,222
obj,num,20120606-18:01:41
dumy,11311
foo,2422
obj,num,20120606-19:01:41
dumy,41111
foo,24442
```

![](/assets/img/safememory/safememory1.png)


## 总结：

*  野指针可以使用shared_ptr和weak_ptr结合使用来尽量规避。
*  使用shared_ptr要尽量小心，否则可能导致对象无法释放，导致内存泄漏。
*  可以定时输出当前所有对象的数量，来分析是否有内存泄漏，或者内存泄漏是有哪些对象引起的。
*  本文介绍了记录所有对象的方法，除了可以分析内存泄漏外，也不失为数据分析的一种方法。需要注明的是，本方法不能替代valgrind工具，二者作用不同。
*  TYPE_NAME 的实现参考