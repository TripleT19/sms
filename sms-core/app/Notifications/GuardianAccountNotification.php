<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class GuardianAccountNotification extends Notification
{
    use Queueable;

    protected $token;
    protected $studentName;

    /**
     * Create a new notification instance.
     *
     * @param  string  $token   Password reset token
     * @param  string  $studentName  Full name of the enrolled student
     */
    public function __construct($token, $studentName)
    {
        $this->token = $token;
        $this->studentName = $studentName;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via($notifiable)
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail($notifiable)
    {
        // Build the reset URL pointing to your React app
        $frontendUrl = config('app.frontend_url') . '/password-reset';
        $resetUrl = $frontendUrl . '?token=' . $this->token . '&email=' . urlencode($notifiable->email);

        return (new MailMessage)
            ->subject('Your Parent Portal Account has been created – ' . config('app.name'))
            ->greeting('Dear ' . $notifiable->first_name . ',')
            ->line('Congratulations! An account has been created for you on the **' . config('app.name') . '** parent portal.')
            ->line('You are now linked as a guardian of **' . $this->studentName . '**.')
            ->line('To access your child\'s academic information, please set your password by clicking the button below:')
            ->action('Set Your Password', $resetUrl)
            ->line('This link will expire in ' . config('auth.passwords.users.expire') . ' minutes.')
            ->line('If you did not expect this account, please ignore this email.')
            ->salutation('Warm regards,<br>' . config('app.name') . ' Team');
    }
}