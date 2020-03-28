---
layout: post
title:  linux epoll 开发指南-【ffrpc源码解析】
categories: fflib
tagline: Epoll主要在服务器编程中使用，本文主要探讨服务器程序中epoll的使用技巧
tags:
    - epoll
    - socket
    - c++
    - fflib
excerpt: >
    Epoll主要在服务器编程中使用，本文主要探讨服务器程序中epoll的使用技巧。Epoll一般和异步io结合使用，故本文讨论基于以下应用场合
---


## 摘要
关于epoll的问题很早就像写文章讲讲自己的看法，但是由于ffrpc一直没有完工，所以也就拖下来了。
Epoll主要在服务器编程中使用，本文主要探讨服务器程序中epoll的使用技巧。Epoll一般和异步io结合使用，故本文讨论基于以下应用场合：

*  主要讨论服务器程序中epoll的使用，主要涉及tcp socket的相关api。
*  Tcp socket 为异步模式，包括socket的异步读写，以及监听的异步操作。
*  本文不会过多讨论API的细节，而是专注流程与设计。
### Epoll 的io模型
Epoll是为异步io操作而设计的，epoll中IO事件被分为read事件和write事件，如果大家对于linux的驱动模块或者linux io 模型有接触的话，就会理解起来更容易。Linux中IO操作被抽象为read、write、close、ctrl几个操作，所以epoll只提供read、write、error事件，是和linux的io模型是统一的。

*  当epoll通知read事件时，可以调用io系统调用read读取数据
*  当epoll通知write事件时，可以调用io系统调用write发送数据
*  当error事件时，可以close回收资源
*  Ctrl相关的接口则用来设置socket的非阻塞选项等。
为什么要了解epoll的io模型呢，本文认为，某些情况下epoll操作的代码的复杂性是由于代码中的模型（或者类设计）与epoll io模型不匹配造成的。
换句话说，如果我们的编码模型和epoll io模型匹配，那么非阻塞socket的编码就会很简单、清晰。

#### 按照epoll模型构建的类关系为：

```cpp
//! 文件描述符相关接口
typedef int socket_fd_t;
class fd_i
{
public:
    virtual ~fd_i(){}

    virtual socket_fd_t socket()          = 0;
    virtual int handle_epoll_read()  = 0;
    virtual int handle_epoll_write() = 0;
    virtual int handle_epoll_del()          = 0;

    virtual void close()                          = 0;
};
int epoll_impl_t::event_loop()
{
    int i = 0, nfds = 0;
    struct epoll_event ev_set[EPOLL_EVENTS_SIZE];

    do
    {
        nfds  = ::epoll_wait(m_efd, ev_set, EPOLL_EVENTS_SIZE, EPOLL_WAIT_TIME);

        if (nfds < 0 && EINTR == errno)
        {
            nfds = 0;
            continue;
        }
        for (i = 0; i < nfds; ++i)
        {
            epoll_event& cur_ev = ev_set[i];
            fd_i* fd_ptr            = (fd_i*)cur_ev.data.ptr;
            if (cur_ev.data.ptr == this)//! iterupte event
            {
                if (false == m_running)
                {
                    return 0;
                }

                //! 删除那些已经出现error的socket 对象
                fd_del_callback();
                continue;
            }
    
            if (cur_ev.events & (EPOLLIN | EPOLLPRI))
            {
                fd_ptr->handle_epoll_read();
            }

            if(cur_ev.events & EPOLLOUT)
            {
                fd_ptr->handle_epoll_write();
            }

            if (cur_ev.events & (EPOLLERR | EPOLLHUP))
            {
                fd_ptr->close();
            }
        }
        
    }while(nfds >= 0);

    return 0;
}
```
 

### Epoll的LT模式和ET模式的比较
先简单比较一下level trigger 和 edge trigger 模式的不同。

#### LT模式的特点是：
*  若数据可读，epoll返回可读事件
*  若开发者没有把数据完全读完，epoll会不断通知数据可读，直到数据全部被读取。
*  若socket可写，epoll返回可写事件，而且是只要socket发送缓冲区未满，就一直通知可写事件。
*  优点是对于read操作比较简单，只要有read事件就读，读多读少都可以。
*  缺点是write相关操作较复杂，由于socket在空闲状态发送缓冲区一定是不满的，故若socket一直在epoll wait列表中，则epoll会一直通知write事件，所以必须保证没有数据要发送的时候，要把socket的write事件从epoll wait列表中删除。而在需要的时候在加入回去，这就是LT模式的最复杂部分。
#### ET模式的特点是：
*  若socket可读，返回可读事件
*  若开发者没有把所有数据读取完毕，epoll不会再次通知epoll read事件，也就是说存在一种隐患，如果开发者在读到可读事件时，如果没有全部读取所有数据，那么可能导致epoll在也不会通知该socket的read事件。（其实这个问题并没有听上去难，参见下文）。
*  若发送缓冲区未满，epoll通知write事件，直到开发者填满发送缓冲区，epoll才会在下次发送缓冲区由满变成未满时通知write事件。
*  ET模式下，只有socket的状态发生变化时才会通知，也就是读取缓冲区由无数据到有数据时通知read事件，发送缓冲区由满变成未满通知write事件。
*  缺点是epoll read事件触发时，必须保证socket的读取缓冲区数据全部读完（事实上这个要求很容易达到）
*  优点：对于write事件，发送缓冲区由满到未满时才会通知，若无数据可写，忽略该事件，若有数据可写，直接写。Socket的write事件可以一直发在epoll的wait列表。Man epoll中我们知道，当向socket写数据，返回的值小于传入的buffer大小或者write系统调用返回EWouldBlock时，表示发送缓冲区已满。

让我们换一个角度来理解ET模式，事实上，epoll的ET模式其实就是socket io完全状态机。

### 先来看epoll中read 的状态图:
![](/assets/img/linuxepoll/linuxepoll1.jpg)

 

当socket由不可读变成可读时，epoll的ET模式返回read 事件。对于read 事件，开发者需要保证把读取缓冲区数据全部读出，man epoll可知：
*  Read系统调用返回EwouldBlock，表示读取缓冲区数据全部读出
*  Read系统调用返回的数值小于传入的buffer参数，表示读取缓冲区全部读出。

#### 示例代码

```cpp
int socket_impl_t:: handle_epoll_read ()
{
    if (is_open())
    {
        int nread = 0;
        char recv_buffer[RECV_BUFFER_SIZE];
        do
        {
            nread = ::read(m_fd, recv_buffer, sizeof(recv_buffer) - 1);
            if (nread > 0)
            {
                recv_buffer[nread] = '\0';
                m_sc->handle_read(this, recv_buffer, size_t(nread));
                if (nread < int(sizeof(recv_buffer) - 1))
                {
                        break;//! equal EWOULDBLOCK
                }
            }
            else if (0 == nread) //! eof
            {
                this->close();
                return -1;
            }
            else
            {
                if (errno == EINTR)
                {
                    continue;
                }
                else if (errno == EWOULDBLOCK)
                {
                    break;
                }
                else
                {
                    this->close();
                    return -1;
                }
            }
        } while(1);
    }
    return 0;
}
```
 
再来看write 的状态机：

![](/assets/img/linuxepoll/linuxepoll2.jpg)

需要读者注意的是，socket模式是可写的，因为发送缓冲区初始时空的。故应用层有数据要发送时，直接调用write系统调用发送数据，若write系统调用返回EWouldBlock则表示socket变为不可写，或者write系统调用返回的数值小于传入的buffer参数的大小，这时需要把未发送的数据暂存在应用层待发送列表中，等待epoll返回write事件，再继续发送应用层待发送列表中的数据，同样若应用层待发送列表中的数据没有一次性发完，那么继续等待epoll返回write事件，如此循环往复。所以可以反推得到如下结论，若应用层待发送列表有数据，则该socket一定是不可写状态，那么这时候要发送新数据直接追加到待发送列表中。若待发送列表为空，则表示socket为可写状态，则可以直接调用write系统调用发送数据。总结如下：

*  当发送数据时，若应用层待发送列表有数据，则将要发送的数据追加到待发送列表中。否则直接调用write系统调用。
*  Write系统调用发送数据时，检测write返回值，若返回数值>0且小于传入的buffer参数大小，或返回EWouldBlock错误码，表示，发送缓冲区已满，将未发送的数据追加到待发送列表
*  Epoll返回write事件后，检测待发送列表是否有数据，若有数据，依次尝试发送指导数据全部发送完毕或者发送缓冲区被填满。
#### 示例代码：

```cpp
void socket_impl_t::send_impl(const string& src_buff_)
{
    string buff_ = src_buff_;

    if (false == is_open() || m_sc->check_pre_send(this, buff_))
    {
        return;
    }
    //! socket buff is full, cache the data
    if (false == m_send_buffer.empty())
    {
        m_send_buffer.push_back(buff_);
        return;
    }

    string left_buff;
    int ret = do_send(buff_, left_buff);

    if (ret < 0)
    {
        this ->close();
    }
    else if (ret > 0)
    {
        m_send_buffer.push_back(left_buff);
    }
    else
    {
        //! send ok
        m_sc->handle_write_completed(this);
    }
}
int socket_impl_t:: handle_epoll_write ()
{
    int ret = 0;
    string left_buff;

    if (false == is_open() || true == m_send_buffer.empty())
    {
        return 0;
    }

    do
    {
        const string& msg = m_send_buffer.front();
        ret = do_send(msg, left_buff);

        if (ret < 0)
        {
            this ->close();
            return -1;
        }
        else if (ret > 0)
        {
            m_send_buffer.pop_front();
            m_send_buffer.push_front(left_buff);
            return 0;
        }
        else
        {
            m_send_buffer.pop_front();
        }
    } while (false == m_send_buffer.empty());

    m_sc->handle_write_completed(this);
    return 0;
}
```
 
## 总结
*  LT模式主要是读操作比较简单，但是对于ET模式并没有优势，因为将读取缓冲区数据全部读出并不是难事。而write操作，ET模式则流程非常的清晰，按照完全状态机来理解和实现就变得非常容易。而LT模式的write操作则复杂多了，要频繁的维护epoll的wail列表。
*  在代码编写时，把epoll ET当成状态机，当socket被创建完成（accept和connect系统调用返回的socket）时加入到epoll列表，之后就不用在从中删除了。为什么呢？man epoll中的FAQ告诉我们，当socket被close掉后，其自动从epoll中删除。对于监听socket简单说几点注意事项：
*  监听socket的write事件忽略
*  监听socket的read事件表示有新连接，调用accept接受连接，直到返回EWouldBlock。
*  对于Error事件，有些错误是可以接受的错误，比如文件描述符用光的错误
示例代码:

```cpp
int acceptor_impl_t::handle_epoll_read()
{
    struct sockaddr_storage addr;
    socklen_t addrlen = sizeof(addr);

    int new_fd = -1;
    do
    {
        if ((new_fd = ::accept(m_listen_fd, (struct sockaddr *)&addr, &addrlen)) == -1)
        {
            if (errno == EWOULDBLOCK)
            {
                return 0;
            }
            else if (errno == EINTR || errno == EMFILE || errno == ECONNABORTED || errno == ENFILE ||
                        errno == EPERM || errno == ENOBUFS || errno == ENOMEM)
            {
                perror("accept");//! if too many open files occur, need to restart epoll event
                m_epoll->mod_fd(this);
                return 0;
            }
            perror("accept");
            return -1;
        }

        socket_i* socket = create_socket(new_fd);
        socket->open();
    } while (true);
    return 0;
}
```

*  GitHub ：https://github.com/fanchy/FFRPC
*  ffrpc 介绍: http://www.cnblogs.com/zhiranok/p/ffrpc_summary.html
*  故，综上所述，服务器程序中推荐使用epoll 的ET 模式！！！！
*  更多精彩文章 http://h2cloud.org