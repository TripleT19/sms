<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'first_name',
        'last_name',
        'salutation',
        'name',          
        'username',
        'email',
        'phone',
        'password',
        'profile_pic',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    // Relationships
    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }

    public function qualifications()
    {
        return $this->belongsToMany(Qualification::class);
    }

    // Get the highest role (by level)
    public function highestRole(): ?Role
    {
        return $this->roles()->orderByDesc('level')->first();
    }

    // Check if the user is a parent (has a role with name 'Parent')
    public function isParent(): bool
    {
        return $this->roles()->where('name', 'Parent')->exists();
    }

    // Full name attribute for easy display
    public function getFullNameAttribute(): string
    {
        if ($this->first_name && $this->last_name) {
            return $this->first_name . ' ' . $this->last_name;
        }
        return $this->name ?? 'User';
    }

    /**
     * Send the password reset notification.
     *
     * @param  string  $token
     * @return void
     */
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new \App\Notifications\ResetPasswordNotification($token));
    }

    public function classes() {
        return $this->hasMany(ClassRoom::class, 'teacher_id');
    }

    // Teachers assigned directly to classes
    public function taughtClasses()
    {
        return $this->belongsToMany(ClassRoom::class, 'class_teacher', 'user_id', 'class_id');
    }

    // Streams where user is a teacher
    public function taughtStreams()
    {
        return $this->belongsToMany(Stream::class, 'stream_teacher', 'user_id', 'stream_id');
    }

    public function guardianOf()
    {
        return $this->belongsToMany(Student::class, 'guardian_student')
            ->withPivot('relationship');
    }

    public function conversations()
    {
        return $this->belongsToMany(Conversation::class, 'conversation_participants')
            ->withPivot('role', 'last_read_at')
            ->withTimestamps();
    }

    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_id');
    }
}