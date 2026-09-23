<?php

namespace App\Mail;

use App\Models\ClassRoom;
use App\Models\Term;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ResultsPublishedMail extends Mailable
{
    use Queueable, SerializesModels;

    public User $parent;
    public ClassRoom $class;
    public Term $term;
    public string $assessmentType;

    /**
     * Create a new message instance.
     */
    public function __construct(User $parent, ClassRoom $class, Term $term, string $assessmentType)
    {
        $this->parent = $parent;
        $this->class = $class;
        $this->term = $term;
        $this->assessmentType = $assessmentType;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $typeLabel = $this->assessmentType === 'mid_term' ? 'Mid‑Term' : 'End‑of‑Term';
        return new Envelope(
            subject: "{$typeLabel} Results Published – {$this->class->name}",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'emails.results-published',
            with: [
                'parentName' => $this->parent->first_name,
                'className'  => $this->class->name,
                'termName'   => $this->term->name,
                'assessmentType' => $this->assessmentType,
            ],
        );
    }
}