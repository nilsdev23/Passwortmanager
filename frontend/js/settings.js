import { ajaxJSON, requireAuthOrRedirect, show, qs } from './common.js';


$(function(){
if(!requireAuthOrRedirect()) return;


// Initialstatus laden
refreshTotp();
refreshAlexa();


// TOTP Setup
$('#btnStart').on('click', function(){
ajaxJSON('/totp/setup', 'POST')
.done(d => {
show(qs('#stateDisabled'), false);
show(qs('#stateSetup'), true);
qs('#otpauth').val(d.otpauthUrl);
qs('#qr').attr('src', `data:image/png;base64,${d.qrPngBase64}`);
});
});


$('#formConfirm').on('submit', function(e){
e.preventDefault();
const code = new FormData(this).get('code');
ajaxJSON('/totp/verify', 'POST', { code })
.done(() => refreshTotp())
.fail(() => alert('Code ungültig'));
});


$('#btnDisable').on('click', function(){
if(confirm('TOTP wirklich deaktivieren?')){
ajaxJSON('/totp', 'DELETE').done(() => refreshTotp());
}
});


// Alexa
$('#btnTest').on('click', function(){
ajaxJSON('/alexa/test-ping', 'POST').done(() => alert('Test gesendet'));
});


function refreshTotp(){
ajaxJSON('/totp/status')
.done(s => {
show(qs('#stateDisabled'), !s.enabled);
show(qs('#stateEnabled'), !!s.enabled);
show(qs('#stateSetup'), false);
});
}


function refreshAlexa(){
ajaxJSON('/alexa/link-status')
.done(s => {
if(s.linked){
show(qs('#linked'), true); show(qs('#notLinked'), false);
} else {
show(qs('#notLinked'), true); $('#btnLink').attr('href', s.linkUrl || '#');
}
});
}
});