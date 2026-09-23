<?php

namespace App\Notifications;

use App\Models\ClassRoom;
use App\Models\SchoolInformation;
use App\Models\Term;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResultsPublished extends Notification
{
    use Queueable;

    protected ClassRoom $class;
    protected Term $term;
    protected string $assessmentType;

    /**
     * Create a new notification instance.
     */
    public function __construct(ClassRoom $class, Term $term, string $assessmentType)
    {
        $this->class = $class;
        $this->term = $term;
        $this->assessmentType = $assessmentType;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $school = SchoolInformation::first();
        $appName = $school->school_name ?? config('app.name', 'School Management System');
        $typeLabel = $this->assessmentType === 'mid_term' ? 'Mid‑Term' : 'End‑of‑Term';

        $frontendUrl = config('app.frontend_url');

        return (new MailMessage)
            ->subject("{$typeLabel} Results Published – {$this->class->name}")
            ->greeting('Dear ' . ($notifiable->first_name ?? 'Parent') . ',')
            ->line("The {$typeLabel} results for **{$this->class->name}** ({$this->term->name}) have been published.")
            ->line('You can now log into the parent portal to view your child’s report card and teacher comments.')
            ->action('View Results', $frontendUrl . '/dashboard/current-records')
            ->line('If you have any questions, please contact the school administration.')
            ->salutation('Warm regards,<br>' . $appName . ' Team');
    }
}