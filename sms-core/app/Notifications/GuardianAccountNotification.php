<?php

namespace App\Notifications;

use App\Models\SchoolInformation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class GuardianAccountNotification extends Notification
{
    use Queueable;

    protected $token;
    protected $studentName;

    public function __construct($token, $studentName)
    {
        $this->token = $token;
        $this->studentName = $studentName;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $school = SchoolInformation::first();
        $appName = $school->school_name ?? config('app.name', 'School Management System');

        $frontendUrl = config('app.frontend_url') . '/password-reset';
        $resetUrl = $frontendUrl . '?token=' . $this->token . '&email=' . urlencode($notifiable->email);

        return (new MailMessage)
            ->subject('Activate Your Parent Account – ' . $appName)
            ->greeting('Dear ' . ($notifiable->first_name ?? 'Parent') . ',')
            ->line('A parent account has been created for you at ' . $appName . '.')
            ->line('You are linked to the student: **' . $this->studentName . '**.')
            ->line('Click the button below to set your password and access your child’s records:')
            ->action('Set Your Password', $resetUrl)
            ->line('This link will expire in ' . config('auth.passwords.users.expire') . ' minutes.')
            ->salutation('Warm regards,<br>' . $appName . ' Team');
    }
}