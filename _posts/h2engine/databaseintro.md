# H2Engine 数据库的封装 
　　H2Engine目前封装了mysql和sqlite的实现，扩展其他的关系型数据库也非常的容易。

## 数据库的连接
　　数据库的连接参数只有一个字符串,根据前边协议标记自动判断实例化哪个数据库连接。
> ```cpp
string host_ = "mysql://127.0.0.1:3306/dbname/user/password";
string group_= "UserData";
DB_MGR_OBJ.connectDB(host_, group_);
```

　　另外所有数据库的接口都已经注册到脚本中
> ```python
import h2ext
host_ = "mysql://127.0.0.1:3306/dbname/user/password";
group_= "UserData";
dbobj = h2ext.connectDB(host_, group_);
```

　　这个group做啥用？每个group就是一个连接池，我们知道进程内有很多player对象，每个player的增删改查必须要串行的，但是多个player之间的增删改查是需要并行的，这个时候有group组名就非常方便了，当执行查询语句的时候，就可以指定这个组，然后传入userid，数据库组件会根据userid取模找到连接去执行语句，Get it?
> ```cpp
vector<vector<string> > retdata; 
vector<string> col;
string errinfo;
int affectedRows = 0;
string sql = "select * from item";
DB_MGR_OBJ.syncQueryDBGroupMod("UserData", userid, sql, retdata, col, errinfo, affectedRows);
```

　　DB_MGR_OBJ提供了同步和异步的接口，同步一般用于程序初始化，缓存数据，异步用于运行时执行数据库语句。