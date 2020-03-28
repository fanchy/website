---
layout: post
title:  Linux 下设置SVN DIFF
categories: tech
tagline: 当执行svn diff 的时候会调用vimdiff 显示diff内容
tags:
    - linux
    - svndiff
excerpt: >
    当执行svn diff 的时候会调用vimdiff 显示diff内容。
---

### Linux 下设置SVN DIFF

vim ~/.subversion/config 

### 在svn 的配置文件中添加一行
diff-cmd = /usr/local/bin/svndiff

 
### svndiff 是自定义的一个shell文件，其内容如下：

```bash
#!/bin/sh

DIFF="vimdiff" 
LEFT=${6}
RIGHT=${7}

$DIFF -f $LEFT $RIGHT

```

这样，当执行svn diff 的时候会调用vimdiff 显示diff内容


