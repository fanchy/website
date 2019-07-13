/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');

const CompLibrary = require('../../core/CompLibrary.js');

const MarkdownBlock = CompLibrary.MarkdownBlock; /* Used to read markdown */
const Container = CompLibrary.Container;
const GridBlock = CompLibrary.GridBlock;

class HomeSplash extends React.Component {
  render() {
    const {siteConfig, language = ''} = this.props;
    const {baseUrl, docsUrl} = siteConfig;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    const langPart = `${language ? `${language}/` : ''}`;
    const docUrl = doc => `${baseUrl}${docsPart}${langPart}${doc}`;

    const SplashContainer = props => (
      <div className="homeContainer">
        <div className="homeSplashFade">
          <div className="wrapper homeWrapper">{props.children}</div>
        </div>
      </div>
    );

    const Logo = props => (
      <div className="projectLogo">
        <img src={props.img_src} alt="Project Logo" />
      </div>
    );

    const ProjectTitle = () => (
      <h2 className="projectTitle">
        {siteConfig.title}
        <small>{siteConfig.tagline}</small>
      </h2>
    );

    const PromoSection = props => (
      <div className="section promoSection">
        <div className="promoRow">
          <div className="pluginRowBlock">{props.children}</div>
        </div>
      </div>
    );

    const Button = props => (
      <div className="pluginWrapper buttonWrapper">
        <a className="button" href={props.href} target={props.target}>
          {props.children}
        </a>
      </div>
    );

    return (
      <SplashContainer>
        <Logo img_src={`${baseUrl}img/undraw_monitor.svg`} />
        <div className="inner">
          <ProjectTitle siteConfig={siteConfig} />
          <PromoSection>
            <Button href="#try">Try It Out</Button>
            <Button href={docUrl('doc1.html')}>Example Link</Button>
            <Button href={docUrl('doc2.html')}>Example Link 2</Button>
          </PromoSection>
        </div>
      </SplashContainer>
    );
  }
}

class Index extends React.Component {
  render() {
    const {config: siteConfig, language = ''} = this.props;
    const {baseUrl} = siteConfig;

    const Block = props => (
      <Container
        padding={['bottom', 'top']}
        id={props.id}
        background={props.background}>
        <GridBlock
          align="center"
          contents={props.children}
          layout={props.layout}
        />
      </Container>
    );



    const Features = () => (
      <Block layout="fourColumn">
        {[
          {
            content: 'Gate进程处理连接，Worker进程处理逻辑，<br/>经典的多进程架构进行抽象和精简，结构清晰，性能卓越',
            image: `${baseUrl}img/bingfajiqiang.jpg`,
            imageAlign: 'top',
            title: '轻量级多进程并发',
          },
          {
            content: '核心接口c++实现，h2engine提供一个通用的脚本层，<br/>使得无论使用哪个脚本都拥有统一的接口，尽情选择你所钟爱的脚本语言。',
            image: `${baseUrl}img/duoyuyan.jpg`,
            imageAlign: 'top',
            title: '多语言支持',
          },
          
        ]}
      </Block>
    );
    const Features2 = () => (
      <Block layout="fourColumn">
        {[
          {
            content: 'WebSocket / Tcp binary 协议集成<br/>与client的通讯开箱即用，写个浏览器html就可以测试消息！',
            image: `${baseUrl}img/protocol.jpg`,
            imageAlign: 'top',
            title: 'Websocket协议',
          },
          {
            content: '集成了Mysql和Sqlite的实现，<br/>数据库连接池封装了最常用的io异步操作，io异步不阻塞主线程，吞吐量无忧。',
            image: `${baseUrl}img/mysql.jpg`,
            imageAlign: 'top',
            title: 'Mysql异步io',
          },
          
        ]}
      </Block>
    );
    const FeatureCallout = () => (
      <div
        className="productShowcaseSection paddingBottom"
        style={{textAlign: 'center'}}>
        <h2>强大的Worker框架</h2>
        <MarkdownBlock>服务器的全部逻辑都应该编写在Worker上，Gate的作用就相当于http服务的Apache，worker集成了一个非常解耦的基于事件的非侵入式框架。</MarkdownBlock>
      </div>
    );
    
    const LearnHow = () => (
      <Block background="light">
        {[
          {
            content:
              '灵感来源于apache的cgi模式，通用的gate用来接收客户端的请求和推送消息，正因为websocket的普及，使得通用的gate得以变得可能。'+
              'Worker进程就相当于Apache里php的角色，多进程单线程设计，worker进程封装了通用的操作如日志、数据库、定时器、事件机制等，'+
              '其独特的模块化机制，实现了非侵入式的扩展能力。',
            image: `${baseUrl}img/img4.jpg`,
            imageAlign: 'right',
            title: 'H2Engine的设计哲学',
          },
        ]}
      </Block>
    );
    const TryOut = () => (
      <Block id="try">
        {[
          {
            content:
              '经常会被问一句话，你的程序能撑多少人。一般官方一点的回答是这个得根据实际情况而定。实际上后台程序的性能是可以被量化的。' +
              '我们开发的每一个服务器程序，对性能都非常有底，以为我们有数据。So，能撑多少人不少随便猜的，让数据报表来说话。',
            image: `${baseUrl}img/xingneng.jpg`,
            imageAlign: 'left',
            title: '性能收集与分析',
          },
        ]}
      </Block>
    );

    const Description = () => (
      <Block background="dark">
        {[
          {
            content:
              'ffrpc使用epoll（linux下）实现的高性能异步进程间通信库，充分利用了broker分布式模式，使得进车间可以直接使用名字而不是地址'+
              '完成通信，从而更简洁也更加scalability。默认使用thrift，也可以使用自定义格式或者pb。',
            image: `${baseUrl}img/undraw_open_source.svg`,
            imageAlign: 'right',
            title: 'ffrpc进程间通信',
          },
        ]}
      </Block>
    );


    const Showcase = () => {
      if ((siteConfig.users || []).length === 0) {
        return null;
      }

      const showcase = siteConfig.users
        .filter(user => user.pinned)
        .map(user => (
          <a href={user.infoLink} key={user.infoLink}>
            <img src={user.image} alt={user.caption} title={user.caption} />
          </a>
        ));

      const pageUrl = page => baseUrl + (language ? `${language}/` : '') + page;

      return (
        <div className="productShowcaseSection paddingBottom">
          <h2>Who is Using This?</h2>
          <p>This project is used by all these people</p>
          <div className="logos">{showcase}</div>
          <div className="more-users">
            <a className="button" href={pageUrl('users.html')}>
              More {siteConfig.title} Users
            </a>
          </div>
        </div>
      );
    };

    return (
      <div>
        <HomeSplash siteConfig={siteConfig} language={language} />
        <div className="mainContainer">
          <Features />
          <Features2 />
          <FeatureCallout />
          <LearnHow />
          <TryOut />
          <Description />
          <Showcase />
        </div>
      </div>
    );
  }
}

module.exports = Index;
