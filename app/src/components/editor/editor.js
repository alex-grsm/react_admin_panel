import '../../helpers/iframeLoader.js';
import axios from 'axios';
import React, { Component } from 'react';
import DOMHelper from '../../helpers/dom-helper.js';
import EditorText from '../editor-text/editor-text.js';
import UIkit from 'uikit';
import Spinner from '../spinner/spinner.js';
import ConfirmModal from '../confirm-modal/confirm-modal.js';
import ChooseModal from '../choose-modal/choose-modal.js';
import Panel from '../panel/panel.js';
import EditorMeta from '../editor-meta/editor-meta.js';
import EditorImages from '../editor-images/editor-images.js';
import Login from '../login/login.js';

export default class Editor extends Component {
    constructor() {
        super();
        this.currentPage = 'index.html'
        this.state = {
            pageList: [],
            backupsList: [],
            newPageName: '',
            loading: true,
            auth: false,
            loginError: false,
            loginLengthError: false
        }

        this.isLoading = this.isLoading.bind(this);
        this.isLoaded = this.isLoaded.bind(this);
        this.save = this.save.bind(this);
        this.init = this.init.bind(this);
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
        this.restoreBackup = this.restoreBackup.bind(this);
    }

    componentDidMount() {
        this.checkAuth();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.auth !== prevState.auth) {
            this.init(null, this.currentPage);
        }
    }

    checkAuth() {
        axios
            .get("./api/checkAuth.php")
            .then(res => {
                // console.log(res.data)
                this.setState({
                    auth: res.data.auth
                })
            })
    }

    login(pass) {
        if (pass.length > 5) {
            axios
                .post('./api/login.php', {"password": pass})
                .then(res => {
                    this.setState({
                        auth: res.data.auth,
                        loginError: !res.data.auth,
                        loginLengthError: false
                    })
                })
        } else {
            this.setState({
                loginError: false,
                loginLengthError: true
            })
        }
    }

    logout() {
        axios
            .get("./api/logout.php")
            .then(() => {
                window.location.replace("/");
            })
    }

    init(e, page) {
        if (e) {
            e.preventDefault();
        }

        if (this.state.auth) {
            this.isLoading();
            this.iframe = document.querySelector('iframe');
            this.open(page, this.isLoaded);
            this.loadPageList();
            this.loadBackupsList();
        }
    }

    open(page, cb) {
        this.currentPage = page

        axios
            .get(`../${page}?rnd=${Math.random()}`)
            .then(res => DOMHelper.parseStrToDOM(res.data))
            .then(DOMHelper.wrapTextNodes)
            .then(DOMHelper.wrapImages)
            .then(dom => {
                this.virtualDom = dom;
                return dom;
            })
            .then(DOMHelper.serializeDOMtoString)
            .then(html => axios.post('./api/saveTempPage.php', {html}))
            .then(() => this.iframe.load("../yfuy1g221ub_hhg44.html"))
            .then(() => axios.post('./api/deleteTempPage.php',))
            .then(() => this.enableEditing())
            .then(() => this.injectStyles())
            .then(cb);

            this.loadBackupsList()
    }

    async save() {
        this.isLoading()
        const newDom = this.virtualDom.cloneNode(this.virtualDom)
        DOMHelper.onwrapTextNodes(newDom)
        const html = DOMHelper.serializeDOMtoString(newDom)
        await axios
            .post('./api/savePage.php', {pageName: this.currentPage, html})
            .then(() => this.showNotifications('Успешно сохранено', 'success'))
            .catch(() => this.showNotifications('Ошибка сохранения', 'danger'))
            .finally(this.isLoaded);

        this.loadBackupsList() 
    }

    enableEditing() {
        this.iframe.contentDocument.body.querySelectorAll("text-editor").forEach(element => {
            const id = element.getAttribute("nodeid");
            const virtualElement = this.virtualDom.body.querySelector(`[nodeid="${id}"]`);

            new EditorText(element, virtualElement);
        });

        this.iframe.contentDocument.body.querySelectorAll("[editableimgid]").forEach(element => {
            const id = element.getAttribute("editableimgid");
            const virtualElement = this.virtualDom.body.querySelector(`[editableimgid="${id}"]`);

            new EditorImages(element, virtualElement, this.isLoading, this.isLoaded, this.showNotifications);
        });
    }

    injectStyles() {
        const style = this.iframe.contentDocument.createElement('style')
        style.innerHTML = `
            text-editor:hover {
                outline: 3px solid orange;
                outline-offset: 8px;
            }
            text-editor:focus {
                outline: 3px solid red;
                outline-offset: 8px;
            }
            [editableimgid]:hover {
                outline: 3px solid orange;
                outline-offset: 8px;
            }
        `;
        this.iframe.contentDocument.head.appendChild(style)
    }

    showNotifications(message, status) {
        UIkit.notification({message, status});
    }

    loadPageList() {
        axios
            .get('./api/pageList.php')
            .then(res => {
                const pageList = res.data;
                this.setState({ pageList });
              })
            .catch(error => console.log(error));
    }

    loadBackupsList() {
        axios
            .get('./backups/backups.json')
            .then(res => this.setState({ backupsList: res.data.filter(backup => {
                return backup.page === this.currentPage;
            })}))
    }

    restoreBackup(e, backup) {
        if (e) {
          e.preventDefault();
        }
      
        const modal = UIkit.modal.dialog(`
          <div class="uk-modal-body">
            <h2>Подтверждение</h2>
            <p>Вы действительно хотите восстановить страницу из этой резервной копии? Все несохраненные данные будут потеряны!</p>
          </div>
          <div class="uk-modal-footer uk-text-right">
            <button class="uk-button uk-button-default custom-cancel">Отмена</button>
            <button class="uk-button uk-button-primary custom-ok">Восстановить</button>
          </div>
        `);
      
        modal.show();
      
        document.querySelector('.custom-cancel').addEventListener('click', () => {
          modal.hide();
        });
      
        document.querySelector('.custom-ok').addEventListener('click', () => {
          modal.hide();
      
          this.isLoading();
          axios.post('./api/restoreBackup.php', { page: this.currentPage, file: backup })
            .then(() => {
              this.open(this.currentPage, this.isLoaded);
            });
        });
    }
      

    isLoading() {
        this.setState({loading: true});
    }

    isLoaded() {
        this.setState({loading: false});
    }

    render() {
        const {loading, pageList, backupsList, auth, loginError, loginLengthError} = this.state;
        const modal = true;
        let spinner;
        loading ? spinner = <Spinner active/> : spinner = <Spinner />

        if (!auth) {
            return <Login login={this.login} lengthErr={loginLengthError} logErr={loginError}/>
        }
        
        return (
            <>
                <iframe src="" frameBorder="0"></iframe>
                <input id="img-upload" type="file" accept="image/*" style={{display: 'none'}}></input>

                {spinner}

                <Panel/>

                <ConfirmModal 
                    modal={modal}  
                    target={'modal-save'} 
                    method={this.save}
                    text={{
                        title: "Сохранение",
                        descr: "Вы действительно хотите сохранить изменения?",
                        // descrinfo: "Для сохранения резервной копии, опубликуй два раза подряд!",
                        btn: "Опубликовать"
                    }}/>
                
                <ConfirmModal 
                    modal={modal}  
                    target={'modal-logout'} 
                    method={this.logout}
                    text={{
                        title: "Выход",
                        descr: "Вы действительно хотите выйти?",
                        btn: "Выйти"
                    }}/>
                    
                <ChooseModal modal={modal}  target={'modal-open'} data={pageList} redirect={this.init}/>
                <ChooseModal modal={modal}  target={'modal-backup'} data={backupsList} redirect={this.restoreBackup}/>
                {this.virtualDom ?  <EditorMeta modal={modal}  target={'modal-meta'} virtualDom={this.virtualDom}/> : false}
            </>
        )
    }
}