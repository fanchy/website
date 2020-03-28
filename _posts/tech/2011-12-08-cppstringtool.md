---
layout: post
title:  C++ 使用STL string 实现的split，trim，replace
categories: tech
tagline: C++ 使用STL string 实现的split，trim，replace
tags:
    - C++
    - STL string
    - split,trim,replace
excerpt: >
    使用python的时候默认str 对字符串操作支持非常丰富，相信每个C++程序员都自己写过string的strim、split、replace，
    写个小工具函数，留着用，以前偷懒，写了好几次，这次总结一下，贴出来。
---

### 简介
使用python的时候默认str 对字符串操作支持非常丰富，相信每个C++程序员都自己写过string的strim、split、replace，
写个小工具函数，留着用，以前偷懒，写了好几次，这次总结一下，贴出来。

```cpp
#include <iostream>
#include <vector>
using namespace std;


namespace strtool
{
string trim(const string& str)
{
    string::size_type pos = str.find_first_not_of(' ');
    if (pos == string::npos)
    {
        return str;
    }
    string::size_type pos2 = str.find_last_not_of(' ');
    if (pos2 != string::npos)
    {
        return str.substr(pos, pos2 - pos + 1);
    }
    return str.substr(pos);
}

int split(const string& str, vector<string>& ret_, string sep = ",")
{
    if (str.empty())
    {
        return 0;
    }

    string tmp;
    string::size_type pos_begin = str.find_first_not_of(sep);
    string::size_type comma_pos = 0;

    while (pos_begin != string::npos)
    {
        comma_pos = str.find(sep, pos_begin);
        if (comma_pos != string::npos)
        {
            tmp = str.substr(pos_begin, comma_pos - pos_begin);
            pos_begin = comma_pos + sep.length();
        }
        else
        {
            tmp = str.substr(pos_begin);
            pos_begin = comma_pos;
        }

        if (!tmp.empty())
        {
            ret_.push_back(tmp);
            tmp.clear();
        }
    }
    return 0;
}

string replace(const string& str, const string& src, const string& dest)
{
    string ret;

    string::size_type pos_begin = 0;
    string::size_type pos       = str.find(src);
    while (pos != string::npos)
    {
        cout <<"replacexxx:" << pos_begin <<" " << pos <<"\n";
        ret.append(str.data() + pos_begin, pos - pos_begin);
        ret += dest;
        pos_begin = pos + 1;
        pos       = str.find(src, pos_begin);
    }
    if (pos_begin < str.length())
    {
        ret.append(str.begin() + pos_begin, str.end());
    }
    return ret;
}

}




int main(int argc, char* argv[])
{
    cout << strtool::trim(" nihao ") <<"\n";

    vector<string> vt;
    strtool::split(",o h,,,nice,,,,,,,", vt);
    for (size_t i = 0; i < vt.size(); ++ i)
    {
        cout <<"out:" << vt[i] <<"\n";
    }

    string ret = strtool::replace("xxAxxxAxxAxx", "A", "B");
    cout <<"replace:" << ret <<"\n";
    return 0;
}


```

更多精彩文章 http://h2cloud.org

