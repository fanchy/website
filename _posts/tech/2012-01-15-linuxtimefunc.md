---
layout: post
title:  linux时间相关结构体和函数整理
categories: tech
tagline: linux时间相关结构体和函数整理
tags:
    - cpp
    - time
    - localtime
    - gmtime
    - sleep
excerpt: >
    Linux下常用的时间类型有4个：time_t，struct timeb, struct timeval，struct timespec，clock_t, struct tm.
---

#### linux时间相关结构体和函数整理
### 时间类型。
    Linux下常用的时间类型有4个：time_t，struct timeb, struct timeval，struct timespec，clock_t, struct tm.

#### time_t是一个长整型，一般用来表示用1970年以来的秒数.

该类型定义在<sys/time.h>中.
一般通过 time_t time = time(NULL); 获取.

#### struct timeb结构: 主要有两个成员, 一个是秒, 另一个是毫秒, 精确度为毫秒.
```cpp
struct timeb
{
    time_t time;
    unsigned short millitm;
    short timezone;
    short dstflag;
};
```

由函数int ftime(struct timeb *tp); 来获取timeb.
成功返回0, 失败返回-1.

#### struct timeval有两个成员，一个是秒，一个是微妙.
```cpp
struct timeval 
{
    long tv_sec; /* seconds */
    long tv_usec; /* microseconds */
};
```
由int gettimeofday(struct timeval *tv, struct timezone *tz);获取.
struct timezone结构的定义为:
```cpp
struct timezone
{
   int tz_minuteswest; /* 和Greewich时间差了多少分钟*/
   int tz_dsttime; /* 日光节约时间的状态 */
};
```

####  struct timespec有两个成员，一个是秒，一个是纳秒, 所以最高精确度是纳秒.
```cpp
struct timespec
{
    time_t tv_sec; /* seconds */
    long tv_nsec; /* nanoseconds */
};
```
一般由函数long clock_gettime (clockid_t which_clock, struct timespec *tp); 获取.
获取特定时钟的时间，时间通过tp结构传回，目前定义了6种时钟，分别是
```
　　CLOCK_REALTIME               统当前时间，从1970年1.1日算起
　　CLOCK_MONOTONIC              系统的启动时间，不能被设置
　　CLOCK_PROCESS_CPUTIME_ID     进程运行时间
　　CLOCK_THREAD_CPUTIME_ID      线程运行时间
　　CLOCK_REALTIME_HR            CLOCK_REALTIME的高精度版本
　　CLOCK_MONOTONIC_HR           CLOCK_MONOTONIC的高精度版本
　　获取特定时钟的时间精度：
　　long clock_getres(clockid_t );
　　设置特定时钟的时间：
　　long clock_settime(clockid_t ,struct timespec*);
　　休眠time中指定的时间，如果遇到信号中断而提前返回，则由left_time返回剩余的时间：
　　 long clock_nanosleep(clockid_t ,int flag,timespec* time,timespec* left_time);
```
#### clock_t类型, 由clock_t clock(); 返回获取.

表示进程占用的cpu时间. 精确到微秒.

##### struct tm是直观意义上的时间表示方法：
```cpp
struct tm 
{
    int tm_sec; /* seconds */
    int tm_min; /* minutes */
    int tm_hour; /* hours */
    int tm_mday; /* day of the month */
    int tm_mon; /* month */
    int tm_year; /* year */
    int tm_wday; /* day of the week */
    int tm_yday; /* day in the year */
    int tm_isdst; /* daylight saving time */
};
struct tm* gmtime(const time_t *timep);
struct tm* localtime(const time_t *timep);
time_t mktime(struct tm *tm);
```
gmtime和localtime的参数以及返回值类型相同，区别是前者返回的格林威治标准时间，后者是当地时间.
注意: 这边三个函数都是线程不安全的, 要使用线程安全的版本, 需要使用带_r的版本 -- gmtime_r, localtime_r, mktime_r.
 
 
### 延迟函数
主要的延迟函数有：sleep(),usleep(),nanosleep(),select(),pselect().
```cpp
unsigned int sleep(unsigned int seconds);
void usleep(unsigned long usec);
int nanosleep(const struct timespec *req, struct timespec *rem);
int select(int n, fd_set *readfds, fd_set *writefds, fd_set *exceptfds,struct timeval *timeout);
int pselect(int n, fd_set *readfds, fd_set *writefds, fd_set *exceptfds, const struct timespec *timeout, const sigset_t *sigmask);
```

alarm函数是信号方式的延迟，这种方式不直观，这里不说了。
仅通过函数原型中时间参数类型，可以猜测sleep可以精确到秒级，usleep/select可以精确到微妙级，nanosleep和pselect可以精确到纳秒级。
而实际实现中，linux上的nanosleep和alarm相同，都是基于内核时钟机制实现，受linux内核时钟实现的影响，并不能达到纳秒级的精度，
man nanosleep也可以看到这个说明，man里给出的精度是：Linux/i386上是10 ms ，Linux/Alpha上是1ms。

