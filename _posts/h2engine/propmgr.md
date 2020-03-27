# 游戏服务器设计之属性管理器
　　游戏中角色拥有的属性值很多，运营多年的游戏，往往会有很多个成长线，每个属性都有可能被N个成长线模块增减数值。举例当角色戴上武器时候hp+100点，卸下武器时HP-100点，这样加减逻辑只有一处还比较好控制，如果某天有个特殊功能当被某技能攻击时，角色武器会被击落，这样就会出现减数值的操作不止一处。如果逻辑处理不当，比如击落的时候没有恰当的减数值，再次穿戴武器就导致属性值加了两边，也就是玩家经常说的刷属性。这种bug对游戏平衡性影响很大，反响很恶劣，bug又很难被测试发现。本文将介绍一种管理属性的思路，最大限度的避免此类bug，如果出现bug，也能够很好的排查。

## 设计思路
　　刷属性bug的核心原因是某功能的模块数值加了N次，所以各个模块加的属性要被记录，加过了必须不能重复加。设计这样的数据结构。
> ```cpp
//!各个属性对应一个总值
//!各个属性对应各个模块的分值
template<typename T>
class PropCommonMgr
{
public:
    typedef T ObjType;
    typedef int64_t (*functorGet)(ObjType);
    typedef void (*functorSet)(ObjType, int64_t);
    struct PropGetterSetter
    {
        PropGetterSetter():fGet(NULL), fSet(NULL){}        
        functorGet fGet;
        functorSet fSet;
        std::map<std::string, int64_t> moduleRecord;
    };
    void regGetterSetter(const std::string& strName, functorGet fGet, functorSet fSet){
        PropGetterSetter info;
        info.fGet = fGet;
        info.fSet = fSet;
        propName2GetterSetter[strName] = info;
    }
  public:
      std::map<std::string, PropGetterSetter>    propName2GetterSetter;
  };
```

1.  关于数据结构的get和set，我们为每个属性命名一个名字，这样处理数据的时候会非常方便（比如道具配增加属性等等），角色属性有很多种，这里不能一一定义，所以属性管理器只是映射属性，并不创建属性值。通过regGetterSetter接口，注册get和set的操作映射。为什么不需要提供add和sub接口能，因为add和sub可以通过get和set组合实现。get和set的接口实现如下：
> ```cpp
int64_t get(ObjType obj, const std::string& strName) {
        typename std::map<std::string, PropGetterSetter>::iterator it = propName2GetterSetter.find(strName);
        if (it != propName2GetterSetter.end() && it->second.fGet){
            return it->second.fGet(obj);
        }
        return 0;
    }
    bool set(ObjType obj, const std::string& strName, int64_t v) {
        typename std::map<std::string, PropGetterSetter>::iterator it = propName2GetterSetter.find(strName);
        if (it != propName2GetterSetter.end() && it->second.fSet){
            it->second.fSet(obj, v);
            return true;
        }
        return false;
    }
```
2.  关于add和sub，前面提到要避免刷属性，就必须避免重复加属性。所以每个模块再加属性前必须检查一下是否该模块已经加了属性，如果加过一定要先减后加。因为每次模块加属性都记录在属性管理器中，那么减掉的数值一定是正确的。这样可以避免另外一种常见bug，如加了100，减的时候计算错误减了80，也会积少成多造成刷属性。add和sub的代码如下：
> ```cpp
int64_t addByModule(ObjType obj, const std::string& strName, const std::string& moduleName, int64_t v) {
        typename std::map<std::string, PropGetterSetter>::iterator it = propName2GetterSetter.find(strName);
        if (it != propName2GetterSetter.end() && it->second.fGet && it->second.fSet){
            int64_t ret =it->second.fGet(obj);
            std::map<std::string, int64_t>::iterator itMod = it->second.moduleRecord.find(moduleName);
            if (itMod != it->second.moduleRecord.end()){
                ret -= itMod->second;
                itMod->second = v;
            }
            else{
                it->second.moduleRecord[moduleName] = v;
            }
            ret += v;
            it->second.fSet(obj, ret);
            return ret;
        }
        return 0;
    }
    int64_t subByModule(ObjType obj, const std::string& strName, const std::string& moduleName) {
        typename std::map<std::string, PropGetterSetter>::iterator it = propName2GetterSetter.find(strName);
        if (it != propName2GetterSetter.end() && it->second.fGet && it->second.fSet){
            int64_t ret =it->second.fGet(obj);
            std::map<std::string, int64_t>::iterator itMod = it->second.moduleRecord.find(moduleName);
            if (itMod == it->second.moduleRecord.end()){
                return ret;
            }
            ret -= itMod->second;
            it->second.moduleRecord.erase(itMod);
            it->second.fSet(obj, ret);
            return ret;
        }
        return 0;
    }
    int64_t getByModule(ObjType obj, const std::string& strName, const std::string& moduleName) {
        typename std::map<std::string, PropGetterSetter>::iterator it = propName2GetterSetter.find(strName);
        if (it != propName2GetterSetter.end() && it->second.fGet && it->second.fSet){
            int64_t ret =it->second.fGet(obj);
            std::map<std::string, int64_t>::iterator itMod = it->second.moduleRecord.find(moduleName);
            if (itMod != it->second.moduleRecord.end()){
                return itMod->second;
            }
        }
        return 0;
    }
    std::map<std::string, int64_t> getAllModule(ObjType obj, const std::string& strName) {
        std::map<std::string, int64_t> ret;
        typename std::map<std::string, PropGetterSetter>::iterator it = propName2GetterSetter.find(strName);
        if (it != propName2GetterSetter.end() && it->second.fGet && it->second.fSet){
            ret = it->second.moduleRecord;
        }
        return ret;
    }
```
　　如上代码所示，addByModule和subByModule必须提供模块名，比如穿装备的时候加血量:addByModule('HP', 'Weapon', 100)，而卸下武器的时候只要subByModule('HP', 'Weapon'),因为属性管理器知道减多少。

## 总结  
1.  属性提供一个名字映射有很多好处，比如装备配属性，buff配属性的，有名字相关联会特别方便
2.  提供一个get和set接口的映射，这样属性管理器就和具体的对象的属性字段解耦了。即使是现有的功能模块也可以集成这个属性管理器。
3.  属性的add和sub操作，都在属性管理器中留下记录，这样即使出现问题，通过getByModule getAllModule两个接口亦可以辅助查找问题。
4.  属性管理已经集成到H2Engine中，github地址: [https://github.com/fanchy/h2engine](https://github.com/fanchy/h2engine)
