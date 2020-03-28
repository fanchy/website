---
layout: post
title:  C++使用ffpython嵌入和扩展python
categories: ffpython
tagline: 针对前面使用boost asio 中遇到的问题，对asio进行封装
tags:
    - python
    - c++嵌入python
    - 服务器嵌入python
excerpt: >
    在服务器编程中，经常会用到python脚本技术。Python是最流行的脚本之一，并且python拥有定义良好的C API接口，同时又有丰富的文档，与C++结合非常的适合。
---

## 摘要:
在服务器编程中，经常会用到python脚本技术。Python是最流行的脚本之一，并且python拥有定义良好的C API接口，同时又有丰富的文档，与C++结合非常的适合。通常情况下使用C++封装机制，而用python脚本实现策略或者是控制。使用python和C++结合的技术拥有如下优势：

*  主体系统使用C++实现，保持系统的高效。
*  控制部分使用python，增加开发效率，python的内存垃圾回收，丰富的类库都使C++开发者获益匪浅。
*  Python脚本可以运行期重载，可以实现控制部分不停机热更新。

C++与python的编程范式有很大不同，当使用python C API调用python时，python中的一些特有机制会给C++开发者带来很多困惑。常常使用python C API时需要注意如下几点:

*  Python 使用引用计数管理内存，调用python C API时对于返回值返回的是借用的引用还是新的引用，需要根据文档仔细确认。否则轻则出现内存泄露，重则程序崩溃。
*  Python中的数据结构与C++的有很大不同。Python常用的有tuple，list，dict。而c++常用的事vector，list，map，并且c++是强类型的。当c++与python进行交互时，C++层希望操作python数据结构就像操作c++ STL一样方便，而在python脚本层，又希望c++传入的参数或返回值都是原生的python数据
*  C++中常用的指针传递对象，当嵌入python时，需要把c++对象传递到python中。

Ffpython是专门方便C++嵌入python开发的类库，基于ffpython一方面可以轻松的将python集成到C++系统，另一方面，C++对象或接口也可以很容易被python使用，总之ffpython简化了c++与python的交互操作。

## 嵌入python
最简单的使用python的方式是把python脚本当作配置，如获取脚本中的一个字符串变量。Python的脚本文件会被python虚拟机import为module，和python的标准库的module实际上是相似的概念。Ffpython封装了获取python module中的变量的操作。
```cpp
printf("sys.version=%s\n", ffpython.get_global_var<string>("sys", "version").c_str());
``` 

上面的代码获取python标准库中sys的version变量值，ffpython通过模板函数的自动将python的str类型自动适配到c++的string类型。get_global_var是获取变量的接口，与之对应的是设置变量的借口get_global_var：
```cpp
ffpython.get_global_var("fftest", "global_var", "OhNice");
printf("fftest.global_var=%s\n", ffpython.get_global_var<string>("fftest", "global_var").c_str());
``` 

调用python函数是嵌入python非常常用的操作，ffpython中提供了call接口用于调用python中的module的函数：
```cpp
printf("time.asctime=%s\n", ffpython.call<string>("time", "asctime").c_str());
```

上面的代码调用time模块的asctime方法，我们也可以使用call接口调用我们自己编写的函数：
```cpp
int a1 = 100; float a2 = 3.14f; string a3 = "OhWell";
ffpython.call<void>("fftest", "test_base", a1, a2, a3);
```

Call被定义为模版函数，传入的参数会自动适配到python相应的类型。对应的python函数为：
```python
def test_base(a1, a2, a3):
       print('test_base', a1, a2, a3)
       return 0
``` 

上面的python函数接受三个参数，c++传入了三个标准类型参数，实际上call接口最多支持9个泛型参数，常用的stl 参数是被支持的：

```cpp
void test_stl(ffpython_t& ffpython)
{
    vector<int> a1;a1.push_back(100);a1.push_back(200);
    list<string> a2; a2.push_back("Oh");a2.push_back("Nice");
    vector<list<string> > a3;a3.push_back(a2);
    ffpython.call<bool>("fftest", "test_stl", a1, a2, a3);
}
```
 

对应调用的python函数为：
```python
def test_stl(a1, a2, a3):
       print('test_stl', a1, a2, a3)
       return True
``` 

不但STL泛型被支持，嵌套定义的类似vector<list<string> > 的结构都是被支持的，vector和list都会转换成python的list结构，而map则转换为dict结构。

调用call接口必须指定接收的返回值类型，可以使用void忽略返回值，除了可以使用标准类型，stl接口也可以被使用，python中的tuple和list可以转换成vector和list，dict则可以被转换成map。需要注意的是，若类型没有匹配，call函数将会抛出异常。用户可以catch标准异常，what接口返回的字符串包含了异常的traceback信息方便排查错误。示例如下：

```cpp
    try{
    ......

       }
       catch(exception& e)
       {
              printf("exception traceback %s\n", e.what());
       }
```
 

## 扩展python
Ffpython 可以注册static函数到python中，全局的C风格的static函数和类中定义的static函数都可以被注册到python中，示例如下： 

```cpp
static int print_val(int a1, float a2, const string& a3, const vector<double>& a4)
{
    printf("%s[%d,%f,%s,%d]\n", __FUNCTION__, a1, a2, a3.c_str(), a4.size());
    return 0;
}
struct ops_t
{
    static list<int> return_stl()
    {
        list<int> ret;ret.push_back(1024);
        printf("%s\n", __FUNCTION__);
        return ret;
    }
};

void test_reg_function()
{
    ffpython_t ffpython;
    ffpython.reg(&print_val, "print_val")
            .reg(&ops_t::return_stl, "return_stl");
    ffpython.init("ext1");
    ffpython.call<void>("fftest", "test_reg_function");
}
```
 

以上代码注册了两个接口给python，然后调用fftest文件中的test_reg_function测试两个接口，fftest.py中定义测试代码：
```python
def test_reg_function():
    import ext1
    ext1.print_val(123, 45.6 , "----789---", [3.14])
    ret = ext1.return_stl()
    print('test_reg_function', ret)
 
```
这两个接口虽然简单，但是说明了ffpython注册的接口支持多个参数，参数类型可以是标准C++类型，也可以是STL泛型。同样返回值的类型也是如此。

使用ffpython 注册C++的对象也很容易，ffpython支持注册c++类的构造函数，成员变量，成员方法到python，示例代码如下：

 

```cpp
class foo_t
{
public:
    foo_t(int v_):m_value(v_)
    {
        printf("%s\n", __FUNCTION__);
    }
    virtual ~foo_t()
    {
        printf("%s\n", __FUNCTION__);
    }
    int get_value() const { return m_value; }
    void set_value(int v_) { m_value = v_; }
    void test_stl(map<string, list<int> >& v_) 
    {
        printf("%s\n", __FUNCTION__);
    }
    int m_value;
};

class dumy_t: public foo_t
{
public:
    dumy_t(int v_):foo_t(v_)
    {
        printf("%s\n", __FUNCTION__);
    }
    ~dumy_t()
    {
        printf("%s\n", __FUNCTION__);
    }
    void dump() 
    {
        printf("%s\n", __FUNCTION__);
    }
};


static foo_t* obj_test(dumy_t* p)
{
    printf("%s\n", __FUNCTION__);
    return p;
}

void test_register_base_class(ffpython_t& ffpython)
{
    ffpython.reg_class<foo_t, PYCTOR(int)>("foo_t")
            .reg(&foo_t::get_value, "get_value")
            .reg(&foo_t::set_value, "set_value")
            .reg(&foo_t::test_stl, "test_stl")
            .reg_property(&foo_t::m_value, "m_value");

    ffpython.reg_class<dumy_t, PYCTOR(int)>("dumy_t", "dumy_t class inherit foo_t ctor <int>", "foo_t")
        .reg(&dumy_t::dump, "dump");

    ffpython.reg(obj_test, "obj_test");

    ffpython.init();
    ffpython.call<void>("fftest", "test_register_base_class");
};
```
 

当c++类型被注册到python中后，python中使用该类型就像python内建的类型一样方便，需要注意的是，如果python中动态的创建了c++对象，那么他是被python的GC管理生命周期的，所以当变量不在被引用时，c++对象的析构函数被调用。对应的fftest.py中测试的脚本代码为：

```python
def test_register_base_class():
    import ext2
    foo = ext2.foo_t(20130426)
    print("test_register_base_class get_val:", foo.get_value())
    foo.set_value(778899)
    print("test_register_base_class get_val:", foo.get_value(), foo.m_value)
    foo.test_stl({"key": [11,22,33] })
    print('test_register_base_class test_register_base_class', foo)
```
 

同前边所诉的原则相同，支持C++ 标准内建类型和STL 泛型。当这个python函数返回时，foo_t的析构函数会被调用。

dumy_t是foo_t的子类。使用ffpython可以方便表示两个类型的关系。如果基类已经定义的接口，子类不需要重复定义，比如要注册子类：

```cpp
ffpython.reg_class<dumy_t, PYCTOR(int)>("dumy_t", "dumy_t class inherit foo_t ctor <int>", "foo_t")
        .reg(&dumy_t::dump, "dump");

void test_register_inherit_class(ffpython_t& ffpython)
{
    ffpython.call<void>("fftest", "test_register_inherit_class");
};
```
 

只需要单独注册一下子类特有的接口，其他接口自动从foo_t基类中继承而来，相应的测试python脚本代码为：

```python
def test_register_inherit_class():
    import ext2
    dumy = ext2.dumy_t(20130426)
    print("test_register_inherit_class get_val:", dumy.get_value())
    dumy.set_value(778899)
    print("test_register_inherit_class get_val:", dumy.get_value(), dumy.m_value)
    dumy.test_stl({"key": [11,22,33] })
    dumy.dump()
    print('test_register_inherit_class', dumy)
```
 

Ffpython中一个非常用用的特性是，c++创建的对象可以传递到python中，而python使用起来就像正常的python对象一样，另外python创建的c++对象也可以传递到c++中，简单示例代码：

```cpp
ffpython.reg(obj_test, "obj_test");

void test_cpp_obj_to_py(ffpython_t& ffpython)
{
    foo_t tmp_foo(2013);
    ffpython.call<void>("fftest", "test_cpp_obj_to_py", &tmp_foo);
}

void test_cpp_obj_py_obj(ffpython_t& ffpython)
{
    dumy_t tmp_foo(2013);
    
    foo_t* p = ffpython.call<foo_t*>("fftest", "test_cpp_obj_py_obj", &tmp_foo);
}
```
 

相应的fftest.py中的测试脚本代码为：

```cpp
def test_cpp_obj_to_py(foo):
    import ext2
    print("test_cpp_obj_to_py get_val:", foo.get_value())
    foo.set_value(778899)
    print("test_cpp_obj_to_py get_val:", foo.get_value(), foo.m_value)
    foo.test_stl({"key": [11,22,33] })
    print('test_cpp_obj_to_py test_register_base_class', foo)

def test_cpp_obj_py_obj(dumy):
    import ext2
    print("test_cpp_obj_py_obj get_val:", dumy.get_value())
    dumy.set_value(778899)
    print("test_cpp_obj_py_obj get_val:", dumy.get_value(), dumy.m_value)
    dumy.test_stl({"key": [11,22,33] })
    dumy.dump()
    ext2.obj_test(dumy)
    print('test_cpp_obj_py_obj', dumy)
    
    return dumy
```
 

## 总结：
*  Ffpython 支持c++调用python函数，获取和设置模块内的变量
*  Ffpython call接口最多支持9个泛型参数，支持的类型包括c++内建的类型和STL 泛型。以及已经被注册的c++类的指针类型。返回值的类型约束同样如此。c++ STL中的vector和list对应于python的tuple和list，map类型则对应于dict。
*  Ffpython支持将c++的静态函数注册到python中。
*  Ffpython支持c++类的注册，并且支持继承。Python中操作c++对象就像操作原生python对象一样。
*  Ffpython注册的c++类在python中被创建后，将会由python GC负责回收内存。
*  Ffpython 类库只有一个文件，并且不依赖其他第三方库，非常容易集成到项目中。而且ffpython遵从开源协议。
*  Ffpython使用c++模板技术，封装了python C API的使用细节，保持精巧和简洁，效率和完全的python C API编写的代码几乎相同。Ffpython的实现可以作为非常好的python C API的示例。
*  Github项目地址：https://github.com/fanchy/ffpython

更多精彩文章 http://h2cloud.org