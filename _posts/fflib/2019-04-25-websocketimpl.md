---
layout: post
title:  WebSocket协议详解与c++&c#实现
categories: fflib
tagline: Websocket协议是全双工的、基于数据帧的、建立在tcp之上的长连接协议。
tags:
    - fflib
    - Websocket协议
    - socket
excerpt: >
    封装了epoll和socket
---

## 摘要：
随着手机游戏、H5游戏以及微信小游戏的普及，越来越多的客户端-服务器端的通讯采用websocket协议。
Websocket协议是全双工的、基于数据帧的、建立在tcp之上的长连接协议。Websocket的协议是头是字符串的兼容http的，

而握手之后的数据帧则是紧凑的二进制，所以websocket是紧凑和高效的。现在主流的PC浏览器以及手机浏览器对websocket都实现了非常成熟的支持。
Websocket协议有着统一的标准的，所有websocket通讯无论实现的语言如何，无论使用的终端如何，最终都是一致的。
Websocket的有点有：

1.	Websocket有公共的标准，有很多公共的库可以使用，比如web端，各个浏览器都已原生的支持websocket，所以拿来即用，非常的方便。比如cocos2dx就继承了websocket。
2.	比如游戏使用了websocket，那么就可以非常容易的用web调用js发websocket消息，从而模拟客户端的操作。
3.	Websocket相对于http是长连接的，这样就可以实现实时的推送消息。
4.	Websocket既能支持文本格式也可以支持二进制格式，这样无论是js还是c++，都可以适当的选择自己喜欢的数据格式。

![](/assets/img/websocketimpl/websocketimpl1.png)

Websocket可以说完全治好了大家关于长连接使用什么协议的纠结。再游戏行业，服务器一般都是使用C++专门开发的网络程序，常规的一般都是使用比较传统的二进制协议，现在想用websocket的人越来越多，但是可以用于服务器端的websocket库却很少，要不就是库太重量级依赖了太多不需要的模块要不就是绑定了特定的网络接口实现，github上搜了下还websocket库很少。下面介绍一下我的通用websocket解析库，具有如下特点。
1.	轻量，只封装websocket的解析，不依赖任何网络接口，拿来即用。
2.	逻辑清晰，你可以直接看代码，直接能够理解websocket的协议。
3.	One header file only。全部实现就在一个头文件里，集成不能再容易了。
4.	目前提供C++和c#的实现。别的语言我就没空写了，刚兴趣的可以照猫画虎来一个。

## Websocket消息头：
模拟发送websocket非常的容易，我们写一个很简单的html+js就可以实现，当然你可以直接使用我的这个模拟客户端: https://fanchy.github.io/client.html。比如我们输入ip为127.0.0.1端口44000，将会受到这样的文本协议。
```html
GET /chat HTTP/1.1
Host: 127.0.0.1:44000
Connection: Upgrade
Pragma: no-cache
Cache-Control: no-cache
User-Agent: Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36
Upgrade: websocket
Origin: https://fanchy.github.io
Sec-WebSocket-Version: 13
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Sec-WebSocket-Key: 8SIMf+o8pqn1RCe/ivxtPg==
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
```
关键参数有：
*	Get /chat 这个是客户端指定的目录，我们做游戏服务器的，基本上根据目录区分服务器，只根据端口区分服务器，所以这个参数实际上可以忽略。
*	Upgrade: websocket 这个必须有，这个是兼容http的需要，有这个字段说明这个不是普通的http是一个websocket的连接。
*	Sec-WebSocket-Version版本号，可以忽略。
*	Sec-WebSocket-Key这个是用作握手的key，具体使用见下文。
Websocket协议的验证
我们游戏服务器可能使用多种协议，比如同时兼容二进制协议和websocket协议。因为有websocket一定是GET开头的，所以我们可以通过验证第一个消息是不是带GET字符串从而判断对方连接是websocket连接还是普通连接。示例代码：
```cpp
if (statusWebSocketConnection == -1)
{
    return false;
}
cacheRecvData.append(buff, len);
if (dictParams.empty() == true)
{
    std::string& strRecvData = cacheRecvData;
    if (strRecvData.size() >= 3)
    {
        if (strRecvData.find("GET") == std::string::npos)
        {
            statusWebSocketConnection = -1;
            return false;
        }
    }
    else if (strRecvData.size() >= 2)
    {
        if (strRecvData.find("GE") == std::string::npos)
        {
            statusWebSocketConnection = -1;
            return false;
        }
    }
    else
    {
        if (strRecvData.find("G") == std::string::npos)
        {
            statusWebSocketConnection = -1;
            return false;
        }
    }
    statusWebSocketConnection = 1;
    if (strRecvData.find("\r\n\r\n") == std::string::npos)//!header data not end
    {
        return true;
    }
    if (strRecvData.find("Upgrade: websocket") == std::string::npos)
    {
        statusWebSocketConnection = -1;
        return false;
    }
    std::vector<std::string> strLines;
    strSplit(strRecvData, strLines, "\r\n");
    for (size_t i = 0; i < strLines.size(); ++i)
    {
        const std::string& line = strLines[i];
        std::vector<std::string> strParams;
        strSplit(line, strParams, ": ");
        if (strParams.size() == 2)
        {
            dictParams[strParams[0]] = strParams[1];
        }
        else if (strParams.size() == 1 && strParams[0].find("GET") != std::string::npos)
        {
            dictParams["PATH"] = strParams[0];
        }
    }
```

## Websocket的握手
Websocket因为要兼容http，所以会发一个常规的http的协议头，然后进行一次握手从而建立安全连接。Websocket握手的时候也就是建立连接后第一个消息会包含Sec-WebSocket-Key这个字段，服务器接收到这个字段后追加一个固定的guid值"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"，然后做sha1加密并转base64变成可见字符返回给客户端。

```cpp
if (dictParams.find("Sec-WebSocket-Key") != dictParams.end())
{
    const std::string& Sec_WebSocket_Key = dictParams["Sec-WebSocket-Key"];
    std::string strGUID = Sec_WebSocket_Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    std::string dataHashed = sha1Encode(strGUID);
    std::string strHashBase64 = base64Encode(dataHashed.c_str(), dataHashed.length(), false);

    char buff[512] = {0};
    snprintf(buff, sizeof(buff), "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n", strHashBase64.c_str());

    addSendPkg(buff);
}
```
组装成websocket协议头如下：
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: mzjDI+C9Ekz6tc/f5gWv38L5Hu0=
客户端收到服务器的这个应答消息后，握手完成，连接建立完成，开始数据传输。

## 数据帧
与tcp的流式数据不同，与http相似，websocket使用帧的方式传输数据，这样解包实际上是方便的，根据长度解析消息包这个最清晰了。
ABNF如下图所示：
![](/assets/img/websocketimpl/websocketimpl2.png)

*	FIN：1 bit，如果不是分片，这个就是1，如果是分片，并且不是最后一个片，那么就是0
*	RSV1, RSV2, RSV3: 每个1 bit，简单说用不到
*	Opcode: 4 bits， 0，1, 2都代表数据，8代表关闭连接，0X9为ping，0XA为pong其他用不到。
*	Mask: 1 bit 这个客户端必须是1.
*	Payload length: 7 bits, 7+16 bits, 或者 7+64 bits，，如果是小于126就用一个字节表示数据长度，如果等于126，表示后续2字节表示长度，如果是127后续8字节表示长度。
*	Masking-key: 0 or 4 bytes 客户端发送的必须有掩码
*	Payload data不出意外剩下的就是数据了。

```cpp
int nFIN = ((cacheRecvData[0] & 0x80) == 0x80)? 1: 0;
    int nOpcode = cacheRecvData[0] & 0x0F;
    //int nMask = ((cacheRecvData[1] & 0x80) == 0x80) ? 1 : 0; //!this must be 1
    int nPayload_length = cacheRecvData[1] & 0x7F;
    int nPlayLoadLenByteNum = 1;
    if (nPayload_length == 126)
    {
        nPlayLoadLenByteNum = 3;
    }
    int nMaskingKeyByteNum = 4;
    std::string aMasking_key;
    aMasking_key.assign(cacheRecvData.c_str() + 1 + nPlayLoadLenByteNum, nMaskingKeyByteNum);
    std::string aPayload_data;
    aPayload_data.assign(cacheRecvData.c_str() + 1 + nPlayLoadLenByteNum + nMaskingKeyByteNum, nPayload_length);
    int nLeftSize = cacheRecvData.size() - (1 + nPlayLoadLenByteNum + nMaskingKeyByteNum + nPayload_length);

    if (nLeftSize > 0)
    {
        std::string leftBytes;
        leftBytes.assign(cacheRecvData.c_str() + 1 + nPlayLoadLenByteNum + nMaskingKeyByteNum + nPayload_length, nLeftSize);
        cacheRecvData = leftBytes;
    }
    for (int i = 0; i < nPayload_length; i++)
    {
        aPayload_data[i] = (char)(aPayload_data[i] ^ aMasking_key[i % nMaskingKeyByteNum]);
    }

    if (8 == nOpcode)
    {
        addSendPkg(buildPkg("", nOpcode));// close
        bIsClose = true;
    }
    else if (2 == nOpcode || 1 == nOpcode || 0 == nOpcode || 9 == nOpcode)
    {
        if (9 == nOpcode)//!ping
        {
            addSendPkg(buildPkg("", 0xA));// pong
        }

        if (nFIN == 1)
        {
            if (dataFragmentation.size() == 0)
            {
                addRecvPkg(aPayload_data);
            }
            else
            {
                dataFragmentation += aPayload_data;
                addRecvPkg(dataFragmentation);
                dataFragmentation.clear();
            }
        }
        else
        {
            dataFragmentation += aPayload_data;
        }
    }
```

## Ping/pong/close

收到ping就发pong，有可能ping的时候也带着数据，所以要处理下。但是貌似Chrome很长时间不会自动发ping。
服务器收到close消息可以回一个消息应答一下，也可以直接关闭连接。
集成到网络层
在自己的socket里加一个WSProtocol对象，在收到消息的地方一般是HandleRecv函数里加一段WSProtocol判断和处理的代码就可以了，示例如下：

```cpp
if (m_oWSProtocol.handleRecv(buff, len))
{
    const vector<string>& waitToSend = m_oWSProtocol.getSendPkg();
    for (size_t i = 0; i < waitToSend.size(); ++i)
    {
        sp_->sendRaw(waitToSend[i]);
    }
    m_oWSProtocol.clearSendPkg();

    const vector<string>& recvPkg = m_oWSProtocol.getRecvPkg();
    for (size_t i = 0; i < recvPkg.size(); ++i)
    {
        const string& eachRecvPkg = recvPkg[i];
        uint16_t nCmd = 0;
        m_message.getHead().cmd = nCmd;
        m_message.appendToBody(eachRecvPkg.c_str(), eachRecvPkg.size());
        m_message.getHead().size = eachRecvPkg.size();
        this->post_msg(sp_);
        m_message.clear();
    }
    m_oWSProtocol.clearRecvPkg();
    if (m_oWSProtocol.isClose())
    {
        sp_->close();
    }
    return 0;
}
```
## 总结：
*	本文实现的websocket为纯协议解析，不依赖网络层，这样想用老的网络层支持websocket就非常容易啦。
*	本实现就一个头文件，依赖OpenSSL（sha1加密）
*	Github地址 https://github.com/fanchy/h2engine/tree/master/fflib/net/wsprotocol.h
*	同时提供一个c#的版本https://github.com/fanchy/h2engine/blob/master/workercs/fflib/wsprotocol.cs
*	归属于项目：h2engine 地址：https://github.com/fanchy/h2engine，感兴趣的可以star。
*	这是我的github主页https://github.com/fanchy，有些有意思的分享。