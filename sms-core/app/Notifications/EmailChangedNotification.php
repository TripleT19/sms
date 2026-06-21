<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailChangedNotification extends Notification
{
    use Queueable;

    public function __construct()
    {
        //
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Your Email Has Been Updated – ' . config('app.name'))
            ->greeting('Hello ' . ($notifiable->first_name ?? $notifiable->name) . ',')
            ->line('This email address has been registered as the new contact email for your account on ' . config('app.name') . '.')
            ->line('If you did not request this change, please contact the administrator immediately.')
            ->line('Your password and account details remain unchanged.')
            ->salutation('Regards,<br>' . config('app.name') . ' Team');
    }
}