<?php
require 'phpmailer/src/PHPMailer.php';
require 'phpmailer/src/Exception.php';
require 'phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Récupération des données du formulaire
    $name = htmlspecialchars(trim($_POST['name']));
    $email = htmlspecialchars(trim($_POST['email']));
    $message = htmlspecialchars(trim($_POST['message']));

    if (!empty($name) && !empty($email) && !empty($message)) {
        // Configuration de PHPMailer
        $mail = new PHPMailer(true);

        try {
            // Configuration SMTP pour Gmail
            $mail->isSMTP();
            $mail->Host = 'smtp.gmail.com'; // Serveur SMTP de Gmail
            $mail->SMTPAuth = true;
            $mail->Username = '4keezix@gmail.com'; // Remplacez par votre adresse Gmail
            $mail->Password = 'Biscotte03@*'; // Remplacez par le mot de passe de votre compte Gmail
            $mail->SMTPSecure = 'tls';
            $mail->Port = 587;

            // Paramètres de l'email
            $mail->setFrom($email, $name);
            $mail->addAddress('4keezix@gmail.com'); // Remplacez par l'adresse où vous souhaitez recevoir les messages

            // Contenu de l'email
            $mail->isHTML(true);
            $mail->Subject = "New Contact Message from $name";
            $mail->Body = "<strong>Name:</strong> $name<br><strong>Email:</strong> $email<br><br><strong>Message:</strong><br>$message";

            // Envoi de l'email
            $mail->send();
            echo 'Message sent successfully!';
        } catch (Exception $e) {
            echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
        }
    } else {
        echo "<p>All fields are required.</p>";
    }
}
?>
