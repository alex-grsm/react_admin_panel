<?php
session_start();
if ($_SESSION["auth"] != true) {
    header("HTTP/1.1 403 Forbidden");
    die;
}

$file = "../../yfuy1g221ub_hhg44.html";

if (file_exists($file)) {
    unlink($file);
} else {
    header("HTTP/1.1 400 Bad Request");
}