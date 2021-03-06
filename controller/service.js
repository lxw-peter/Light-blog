/* jshint esversion:6 */
const connect = require('../db')
const moment = require('moment')
const marked = require('marked')
const formidable = require('formidable')
const path = require('path')
const fs = require('fs')
// 导入加密模块
const bcrypt = require('bcrypt')
// 更新用户信息
const updateUserInfo = (req,res) => {
    var form = new formidable.IncomingForm();
    form.uploadDir = "./upload/images";
    form.keepExtensions = true;
    form.parse(req, function(err, fields, files) {
        console.log(files)
        console.log(req.session.userInfo)
        var oldName = files.file.path;
        // 文件路径
        var newName = path.join(path.dirname(oldName) + '\\' +req.session.userInfo.id + path.extname(oldName))
        fs.rename(oldName, newName);
        // 将图片信息整合到个人信息中
        // 更新数据
        const sql = `update users set headImg=? where id=?`;
        const  id = req.session.userInfo.id;
        // 图片请求路径
        const imgPath = '\\' + newName;
        connect.query(sql,[imgPath,id], (err,result) => {
            console.log(err)
            console.log(result)
            if (result.affectedRows === 1) {
                res.send({msg:'用户头像保存成功',status: 200,headImg:imgPath})
            } else {
                res.send({msg:'用户头像保存失败',status: 508,headImg:''})

            }
        })
        
    });

}
// 登录页面提交表单
const login = (req,res) => {
    const body = req.body
    // 判断用户信息是否填写完整
    if (body.username.trim().length <=0 || body.password.trim().length <= 0){
        return res.send({msg: '用户名或密码为空，请输入', status: 504})
    }
    // 查询用户名和密码是否匹配
    const sql1 = 'select * from users where username=?'
    connect.query(sql1,body.username,(err,result) => {
        // console.log(err)
        if (err) return res.send({msg: '用户名错误', status: 505})
        if (result.length !== 1) return res.send({ msg: '该用户不存在', status: 502 })
        bcrypt.compare(body.password,result[0].password,(err,compareResult) =>{
            if(err) return res.send({msg: '密码错误', status: 506})
            if (!compareResult) return res.send({msg:'用户登录失败', status: 507})
            // 把登录成功之后的用户信息挂载到session上
            req.session.userInfo = result[0]
            // 把登录成功之后的结果挂载到session上
            req.session.islogin = true
            res.send({msg: '登录成功',status: 200})
        })
    })
}
// 注册页面提交表单
const register = (req, res) => {
    const body = req.body
    // 定义幂次
    const saltRounds = 10
    // 加密的方法
    bcrypt.hash(body.password,saltRounds, (err,pwdCryped) => {
        if(err) console.log('加密失败')
        body.password = pwdCryped
        if (body.username.trim().length <=0 || body.password.trim().length <=0 || body.nickname.trim().length <=0){
            res.send({msg: '请填写完整', status: 501})
        }
        // 查询用户名是否重复
        const sql1 = "select * from users where username = ?"
        const data = body.username
        connect.query(sql1,data,(err,result) => {
            console.log(err,result)
             if (err) return res.send({msg: 'sql执行失败', status: 505})
        // 如果用户名重复则告知客户端
            if (result[0]) return res.send({msg: '用户名重复',status: 502})
            // else return 
            // 执行注册业务逻辑
            const sql2 = "insert into users set?"
            body.ctime = moment().format('YYYY-MM-DD HH-mm-ss')
            connect.query(sql2,body,(err,result) => {
                if (err) return res.send({msg: 'sql执行失败', status: 505})
                if (result.affectedRows !== 1) return res.send({msg: '注册新用户失败', status: 503})
                res.send({msg: '注册成功', status: 200})
            })
        })
    })  
}
// 进入发表文章页面
const addArticlePage = (req, res) => {
    if (!req.session.islogin)  res.redirect('/')
    res.render('./article/add.ejs',{
        userInfo: req.session.userInfo,
        islogin: req.session.islogin
    })
}
// 文章详情页面
const articlePage = (req,res) => {
    const id = req.params.id
    const sql = 'select * from articles where id = ? '
    connect.query(sql, id, (err,result) => {
        // console.log(err,result)
        if (err) return res.send({msg: 'sql执行失败', status: 505})

        if (result.length !== 1) {
            res.redirect('/')
            res.send({msg: "查询文章详情失败", status: 505})
        }
        const html = marked(result[0].article)
        // console.log(html)
        result[0].article = html
        res.render('./article/info.ejs', {
            userInfo: req.session.userInfo,
            islogin: req.session.islogin,
            articleInfo: result[0]
        })
    })
} 
// 提交文章
const addArticle = (req,res) => {
    const body = req.body
    body.ctime = moment().format('YYYY-MM-DD HH-mm-ss')
    const sql = "insert into articles set ?"
    connect.query(sql, body, (err,result) => {
        // console.log(err,result)
        if (err) return res.send({msg: 'sql执行失败', status: 505})

        if (result.affectedRows !== 1) return res.send({msg: '发表文章失败', status: 504})
        res.send({msg: '发表文章成功', status: 200, id: result.insertId})
    })
}
// 进入编辑页面
const editArticlePage = (req, res) => {
    const id = req.params.id
    const sql = 'select * from articles where id = ?'
    connect.query(sql,id,(err,result) => {
        if (err) return res.send({msg: 'sql执行失败', status: 505})

        if (!result[0]) {res.send({msg:'查询文章失败', status: 505})}
        res.render('./article/edit.ejs',{
            userInfo: req.session.userInfo,
            islogin: req.session.islogin,
            articleInfo: result[0]
        })
    })
}
// 编辑提交
const editArticle = (req, res) => {
    const body = req.body
    const sql = 'update articles set ? where id = ?'
    connect.query(sql, [body,body.id], (err,result) => {
        if (err) return res.send({msg: 'sql执行失败', status: 505})        
        if (result.affectedRows !== 1) { res.send({msg:'编辑提交失败', status: 506})}
        res.send({msg: '编辑成功', status: 200, id: body.id})
    })
}
const deleteArticle = (req,res) => {
// TODO
}
module.exports = {
    updateUserInfo,
    login,
    register,
    addArticlePage,
    addArticle,
    articlePage,
    editArticlePage,
    editArticle,
    deleteArticle
}