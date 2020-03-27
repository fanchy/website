# WebSocket 客户端测试功能
　　websocket是有标准的通信协议，在h2engine服务器引擎中继承了websocket通信协议，使用websocket通信协议的好处是很多语言或框架
都内置了websocket的支持，工具也非常多，可以非常方便的测试。比如在逻辑开发过程中，有时候协议定好了，但是由于客户端还没有及时
完成相应功能，那么如果有个模拟的客户端就会非常的方便，这个模拟的客户端只要能够收发协议就好。websocket浏览器天然支持，所以用
浏览器websocket实现模拟客户端非常的方便，使用的人直接省掉了按照客户端的麻烦，直接放到一个webserver上，所有人都能用。

## WebSocket 与服务器通信实现
　　协议设计，websocket与h2engine服务器引擎通信，协议头的格式是cmd:协议号(整型)\n数据,这里参考了http头的协议设计，以\n区别
协议头和协议体，协议头可以有多个参数，逗号分隔，这里只用了cmd，保留了其他协议参数的能力。用字符串的协议头对js这种脚本
语言更友好，更容易兼容其他语言。
> ```javascript
var ws = undefined;
var gHost = '';
function Log(Text, MessageType) {
    if (MessageType == "OK") Text = "<span style='color: green;'>" + Text + "</span>";
    else if (MessageType == "ERROR") Text = "<span style='color: red;'>" + Text + "</span>";
    else if (MessageType == "SEND") Text = "<span style='color: orange;'>" + Text + "</span>";
    document.getElementById("LogContainer").innerHTML = document.getElementById("LogContainer").innerHTML + Text + "<br />";
    var LogContainer = document.getElementById("LogContainer");
    LogContainer.scrollTop = LogContainer.scrollHeight;
};
function btnConnect(){
    if (ws){
        Log("连接已经建立!!。", "ERROR");
        return;
    }
    gHost = document.getElementById("ip").value + ":" + document.getElementById("port").value;
    Log("begin connect:"+gHost)
    gHost +=  "/chat";
    if ("WebSocket" in window) {
        ws = new WebSocket("ws://" + gHost);
    }
    else if("MozWebSocket" in window) {
        ws = new MozWebSocket("ws://" + gHost);
    }
    ws.onopen    = WSonOpen;
    ws.onmessage = WSonMessage;
    ws.onclose   = WSonClose;
    ws.onerror   = WSonError;
}
function btnClose(){
    if (ws)
        ws.close();
}
function WSonOpen() {
    Log("连接已经建立。", "OK");
};
function btnSend(){
    var cmdReq  = $('#cmdSelect').val();
    var dataReq = $('#dataReq').val();
    var reqMsg   = 'cmd:' + cmdReq + '\n'+dataReq;
    ws.send(reqMsg);
}
```

## WebSocket 基于浏览器实现的模拟客户端截图
1.  ip port 设置服务器ip端口
2.  协议号用于填写协议号，整型
3.  协议数据这里只是作为延时只输入字符串，这个正式的应该是根据协议号显示不同的协议结构，然后根据结构字段分别填写。

![Alt text](./images/intro/webclient.png)

## 相关连接
- 文档 [http://h2cloud.org](http://h2cloud.org)
- 源码 [https://github.com/fanchy/h2engine](https://github.com/fanchy/h2engine)

